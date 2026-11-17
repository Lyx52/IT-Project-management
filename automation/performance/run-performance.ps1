$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$testProject = Join-Path $repoRoot 'automation/FindIT.E2E.Tests/FindIT.E2E.Tests.csproj'
$resultsDirectory = Join-Path $PSScriptRoot 'TestResults'
$reportPath = Join-Path $resultsDirectory 'performance-results.json'

New-Item -ItemType Directory -Force -Path $resultsDirectory | Out-Null
$env:PERFORMANCE_API_URL = if ($env:PERFORMANCE_API_URL) { $env:PERFORMANCE_API_URL } else { 'http://localhost:8002' }
$env:PERFORMANCE_FRONTEND_URL = if ($env:PERFORMANCE_FRONTEND_URL) { $env:PERFORMANCE_FRONTEND_URL } else { 'http://localhost:4201' }
$env:PERFORMANCE_REPORT_PATH = $reportPath

function Wait-Url([string]$Url, [int]$TimeoutSeconds = 120) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
            if ($r.StatusCode -eq 200) { return }
        } catch { Start-Sleep -Seconds 2 }
    }
    throw "Timed out waiting for $Url. Is the container running? (docker compose ps)"
}

Push-Location $repoRoot
try {
    # Fail fast with a clear message instead of a Chrome connection error.
    Wait-Url "$($env:PERFORMANCE_API_URL)/up"
    Wait-Url "$($env:PERFORMANCE_FRONTEND_URL)/home"

    docker compose -f docker-compose.yml -f docker-compose.performance.yml exec -T backend-performance php artisan db:seed --class=PerformanceSeeder
    if ($LASTEXITCODE -ne 0) { throw 'Performance dataset seeding failed.' }

    dotnet test $testProject --logger 'trx;LogFileName=performance.trx' --results-directory $resultsDirectory
    if ($LASTEXITCODE -ne 0) { throw "Performance checks failed. See $resultsDirectory" }

    Write-Host "Performance report saved to $reportPath"
    Write-Host "Test report saved to $(Join-Path $resultsDirectory 'performance.trx')"
}
finally {
    Pop-Location
}
