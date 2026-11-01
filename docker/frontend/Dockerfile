FROM node:22-bookworm-slim

ARG UID=1000
ARG GID=1000

ENV NG_CLI_ANALYTICS=false
RUN npm install -g @angular/cli \
    && mkdir -p /var/www/frontend && chown ${UID}:${GID} /var/www/frontend

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER ${UID}:${GID}
WORKDIR /var/www/frontend
EXPOSE 4200
ENTRYPOINT ["entrypoint.sh"]
CMD ["ng", "serve", "--host", "0.0.0.0", "--port", "4200", "--poll", "2000"]
