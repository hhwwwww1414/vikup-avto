FROM python:3.11-slim

WORKDIR /app

# System libs required by opencv-python-headless (glib) and onnxruntime (gomp).
RUN apt-get update \
  && apt-get install -y --no-install-recommends libglib2.0-0 libgomp1 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Pre-download ONNX model weights into the image so startup is fast and does
# not depend on network availability at runtime.
RUN python -c "from anpr import load_models; load_models()"

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
