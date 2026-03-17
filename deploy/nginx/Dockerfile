FROM nginx:1.25-alpine

COPY deploy/nginx/nginx.conf /etc/nginx/nginx.conf

RUN mkdir -p /etc/nginx/certs && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/certs/server.key \
    -out /etc/nginx/certs/server.crt \
    -subj "/C=US/ST=State/L=City/O=IDMatr/CN=localhost"

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
