# ──────────────────────────────────────────────────────────────
#  SmartStock Enterprise Backend – Production Dockerfile
#  Target: Render.com (free tier), Railway, or any Docker host
#  Uses Java 17 + pre-compiled fat JAR (includes PostgreSQL JDBC)
# ──────────────────────────────────────────────────────────────

# Stage 1 — Build: Compile the Java source with JDBC driver
FROM eclipse-temurin:17-jdk-alpine AS builder

WORKDIR /build

# Copy source and JDBC driver
COPY backend/SmartStockBackend.java .
COPY backend/lib/postgresql-42.7.1.jar ./lib/

# Compile into class files
RUN javac -encoding UTF-8 -cp "lib/postgresql-42.7.1.jar" SmartStockBackend.java

# Stage 2 — Run: Slim JRE image only
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Copy compiled classes and JDBC driver from builder
COPY --from=builder /build/SmartStockBackend*.class ./
COPY --from=builder /build/lib/postgresql-42.7.1.jar ./lib/

# Default env vars (all overridden via cloud dashboard)
ENV DB_HOST=aws-1-ap-south-1.pooler.supabase.com
ENV DB_PORT=5432
ENV DB_NAME=postgres
ENV DB_USER=postgres.iucuspicdbqutdphfamc
ENV DB_PASSWORD=changeme
ENV SERVER_PORT=8080

# Render.com assigns PORT env var dynamically — honour it
# We read SERVER_PORT in our Java code; map Render's PORT → SERVER_PORT
CMD ["sh", "-c", "export SERVER_PORT=${PORT:-${SERVER_PORT:-8080}} && \
     java -cp 'lib/postgresql-42.7.1.jar:.' SmartStockBackend"]

EXPOSE 8080
