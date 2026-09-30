FROM alpine:3.20

RUN apk add --no-cache poppler-utils python3

WORKDIR /app
COPY server.py .

EXPOSE 8080
USER nobody
CMD ["python3", "-u", "server.py"]
