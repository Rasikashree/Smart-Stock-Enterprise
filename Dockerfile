# ──────────────────────────────────────────────────────────────
#  SmartStock Enterprise Backend – Dockerfile for Render.com
#  Builds a slim Java 17 image with the PostgreSQL JDBC driver
# ──────────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Copy the pre-compiled backend file and the JDBC driver
COPY backend/SmartStockBackend.java .
COPY backend/lib/postgresql-42.7.1.jar ./lib/postgresql-42.7.1.jar

# Compile at build time
RUN apk add --no-cache openjdk17-jdk 2>/dev/null || true && \
    javac -encoding UTF-8 -cp "lib/postgresql-42.7.1.jar" SmartStockBackend.java

# Expose port
EXPOSE 8080

# Environment variables (override via Render dashboard)
ENV DB_HOST=aws-1-ap-south-1.pooler.supabase.com
ENV DB_PORT=5432
ENV DB_NAME=postgres
ENV DB_USER=postgres.iucuspicdbqutdphfamc
ENV DB_PASSWORD=changeme
ENV SERVER_PORT=8080

# Create .env file from environment variables at startup, then run server
CMD sh -c "echo \"DB_HOST=${DB_HOST}\" > .env && \
           echo \"DB_PORT=${DB_PORT}\" >> .env && \
           echo \"DB_NAME=${DB_NAME}\" >> .env && \
           echo \"DB_USER=${DB_USER}\" >> .env && \
           echo \"DB_PASSWORD=${DB_PASSWORD}\" >> .env && \
           echo \"SERVER_PORT=${SERVER_PORT}\" >> .env && \
           java -cp 'lib/postgresql-42.7.1.jar:.' SmartStockBackend"
