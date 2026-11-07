#!/usr/bin/env bash
# Sets up and reads the Oracle Cloud Object Storage bucket that holds the
# database backups. Run it where the OCI CLI is logged in: easiest is Cloud
# Shell in the Oracle Cloud console (>_ icon, top right). Not on the VM.
# The VM only gets a URL that can write new backups.
#
#   deploy/backup-storage.sh setup
#       Creates the bucket "db-backups" (Standard tier, private, with
#       versioning), the rule that deletes backups after 7 days and a
#       write-only URL. Prints the BACKUP_UPLOAD_URL line for .env.production.
#       Run again to replace the URL (the old one stops working).
#
#   deploy/backup-storage.sh list
#       Lists the stored backups.
#
#   deploy/backup-storage.sh url [backup name]
#       Prints a download URL for one backup (default: the newest), valid
#       for 1 hour. Pass it to deploy/restore-db.sh on the server.
#
# The bucket goes in the root compartment unless BACKUP_COMPARTMENT is set
# to a compartment OCID.
set -euo pipefail

BUCKET=db-backups
RETENTION_DAYS=7
WRITER=backup-writer
URL_VALID_DAYS=365

usage() {
  sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 1
}

# GNU date (Linux, Cloud Shell) or BSD date (macOS)
utc_in() { date -u -d "+$1" +%Y-%m-%dT%H:%M:%SZ 2> /dev/null || date -u -v+"$2" +%Y-%m-%dT%H:%M:%SZ; }

# Cloud Shell sets OCI_TENANCY / OCI_REGION; elsewhere they're in ~/.oci/config
config_value() {
  [ -f ~/.oci/config ] || return 0
  awk -F= -v k="$1" '$1 == k { print $2; exit }' ~/.oci/config | tr -d ' '
}
tenancy() { echo "${OCI_TENANCY:-$(config_value tenancy)}"; }
namespace() { oci os ns get --query data --raw-output; }

# Full URL of a pre-authenticated request from "oci os preauth-request create" output
par_url() {
  python3 -c '
import json, os, sys
d = json.load(sys.stdin)["data"]
if d.get("full-path"):
    print(d["full-path"])
else:
    print("https://objectstorage.%s.oraclecloud.com%s" % (os.environ["REGION"], d["access-uri"]))
'
}

setup() {
  local ns tenancy compartment region
  ns=$(namespace)
  tenancy=$(tenancy)
  [ -n "$tenancy" ] || { echo "Can't find the tenancy OCID, run this in OCI Cloud Shell" >&2; exit 1; }
  compartment=${BACKUP_COMPARTMENT:-$tenancy}
  region=${OCI_REGION:-$(config_value region)}

  if oci os bucket get --bucket-name "$BUCKET" --namespace-name "$ns" > /dev/null 2>&1; then
    echo ">> Bucket $BUCKET already exists"
    if [ "$(oci os bucket get --bucket-name "$BUCKET" --namespace-name "$ns" --query 'data."public-access-type"' --raw-output)" != NoPublicAccess ]; then
      echo "Bucket $BUCKET is public. Backup dumps must never be public." >&2
      echo "Set the bucket to NoPublicAccess (or set BUCKET to a new name) and run setup again." >&2
      exit 1
    fi
    if [ "$(oci os bucket get --bucket-name "$BUCKET" --namespace-name "$ns" --query 'data.versioning' --raw-output)" != Enabled ]; then
      echo "Versioning is off for $BUCKET, so an overwrite could destroy a retained backup." >&2
      echo "Enable versioning (or set BUCKET to a new name) and run setup again." >&2
      exit 1
    fi
  else
    # Standard tier: covered by Always Free and, unlike Infrequent Access or
    # Archive, no minimum storage time.
    echo ">> Creating bucket $BUCKET"
    oci os bucket create --name "$BUCKET" --namespace-name "$ns" --compartment-id "$compartment" \
      --public-access-type NoPublicAccess --storage-tier Standard --versioning Enabled > /dev/null
  fi

  # Write-only: the server can't list, read or delete backups
  echo ">> Write-only URL, valid $URL_VALID_DAYS days"
  local old
  for old in $(oci os preauth-request list --bucket-name "$BUCKET" --namespace-name "$ns" --all \
    --query "data[?name=='$WRITER'].id | join(' ', @)" --raw-output 2> /dev/null); do
    oci os preauth-request delete --bucket-name "$BUCKET" --namespace-name "$ns" --par-id "$old" --force
  done
  local upload_url
  upload_url=$(oci os preauth-request create --bucket-name "$BUCKET" --namespace-name "$ns" \
    --name "$WRITER" --access-type AnyObjectWrite \
    --time-expires "$(utc_in "$URL_VALID_DAYS days" "${URL_VALID_DAYS}d")" | REGION=$region par_url)

  # The region is in the URL host (objectstorage.<region>.…)
  if [[ $upload_url =~ objectstorage\.([a-z0-9-]+)\. ]]; then
    region=${BASH_REMATCH[1]}
  fi
  [ -n "$region" ] || { echo "Can't tell the region, set OCI_REGION" >&2; exit 1; }

  # Lifecycle rules run as the Object Storage service, which needs this policy
  local policy=objectstorage-lifecycle-$region
  if ! oci iam policy list --compartment-id "$tenancy" --all \
    --query "data[?name=='$policy'].id | [0]" --raw-output 2> /dev/null | grep -q ocid1.policy; then
    echo ">> IAM policy $policy (lets Object Storage delete old backups)"
    oci iam policy create --compartment-id "$tenancy" --name "$policy" \
      --description "Lets Object Storage lifecycle rules delete objects (database backups)" \
      --statements "[\"Allow service objectstorage-$region to manage object-family in tenancy\"]" > /dev/null
  fi

  echo ">> Delete rule: backups older than $RETENTION_DAYS days"
  local rule="[{\"name\":\"delete-after-$RETENTION_DAYS-days\",\"action\":\"DELETE\",
    \"timeAmount\":$RETENTION_DAYS,\"timeUnit\":\"DAYS\",\"isEnabled\":true}]"
  local attempt
  # A new IAM policy can take a minute before the rule is accepted
  for attempt in $(seq 1 12); do
    if oci os object-lifecycle-policy put --bucket-name "$BUCKET" --namespace-name "$ns" \
      --items "$rule" --force > /dev/null 2> /tmp/lifecycle-error; then
      break
    fi
    if [ "$attempt" -eq 12 ]; then
      cat /tmp/lifecycle-error >&2
      exit 1
    fi
    echo "   waiting for the IAM policy to take effect..."
    sleep 10
  done

  echo
  echo "Put this line in .env.production on the server, then run deploy/deploy.sh:"
  echo
  echo "BACKUP_UPLOAD_URL=$upload_url"
}

list() {
  oci os object list --bucket-name "$BUCKET" --namespace-name "$(namespace)" --all \
    --fields name,size,timeCreated \
    --query 'sort_by(data, &name)[].{name:name, bytes:size, created:"time-created"}' --output table
}

url() {
  local ns name=${1:-}
  ns=$(namespace)
  if [ -z "$name" ]; then
    name=$(oci os object list --bucket-name "$BUCKET" --namespace-name "$ns" --all --fields name \
      --query 'sort_by(data, &name)[-1].name' --raw-output 2> /dev/null || true)
    [[ $name == *.dump ]] || { echo "No backups in $BUCKET" >&2; exit 1; }
    echo "Newest backup: $name" >&2
  fi
  oci os preauth-request create --bucket-name "$BUCKET" --namespace-name "$ns" \
    --name "restore-$(date -u +%Y%m%dT%H%M%SZ)" --access-type ObjectRead --object-name "$name" \
    --time-expires "$(utc_in "1 hour" 1H)" | REGION=${OCI_REGION:-$(config_value region)} par_url
}

case "${1:-}" in
  setup) setup ;;
  list) list ;;
  url) url "${2:-}" ;;
  *) usage ;;
esac
