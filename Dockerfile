FROM python:3.13-slim-bookworm AS proxy
RUN python -m venv /opt/proxy && /opt/proxy/bin/pip install --no-cache-dir mitmproxy==12.3.1

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates fonts-dejavu fonts-noto-color-emoji tini \
    && rm -rf /var/lib/apt/lists/*
COPY --from=proxy /usr/local/ /usr/local/
COPY --from=proxy /opt/proxy/ /opt/proxy/
WORKDIR /app
COPY . .
RUN useradd --create-home --uid 10001 eventqa && chown -R eventqa:eventqa /app
USER eventqa
ENV NODE_ENV=production PORT=10000 CHROME_PATH=/usr/bin/chromium MITMDUMP_PATH=/opt/proxy/bin/mitmdump CHROME_NO_SANDBOX=1 MAX_SESSIONS=1
EXPOSE 10000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "cloud/server.mjs"]
