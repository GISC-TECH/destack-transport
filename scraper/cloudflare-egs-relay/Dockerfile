FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
RUN pip install --no-cache-dir mitmproxy==12.2.3 httpx==0.28.1
WORKDIR /app
COPY addon.py bridge_protocol.py proxy_health.py /app/
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=35s --start-period=60s --retries=3 CMD ["python", "/app/proxy_health.py"]
ENTRYPOINT ["mitmdump", "-q", "-s", "/app/addon.py", "--listen-host", "0.0.0.0", "--listen-port", "8080", "--set", "confdir=/tmp/mitmproxy", "--set", "connection_strategy=lazy", "--set", "upstream_cert=false", "--set", "flow_detail=0", "--set", "body_size_limit=128m"]
