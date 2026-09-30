FROM alpine:3.20

RUN apk add --no-cache poppler-utils python3 ocrmypdf \
    tesseract-ocr-data-eng

# tesseract OpenCL profiling writes its cache under HOME.
ENV HOME=/tmp

WORKDIR /app
COPY server.py .

EXPOSE 8080
USER nobody
CMD ["python3", "-u", "server.py"]
