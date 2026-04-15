# backend/Dockerfile - FastAPI (Python) image
FROM python:3.11-slim

WORKDIR /app

# system deps for building some wheels and libpq for psycopg2
RUN apt-get update && apt-get install -y build-essential gcc libpq-dev && apt-get clean && rm -rf /var/lib/apt/lists/*

# copy requirements and install
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# copy application code
COPY app ./app

EXPOSE 8000

# start uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]