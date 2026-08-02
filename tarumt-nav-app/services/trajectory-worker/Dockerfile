FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /out/trajectory-worker ./cmd/trajectory-worker

FROM alpine:3.22
RUN adduser -D -u 10001 worker
USER worker
COPY --from=build /out/trajectory-worker /usr/local/bin/trajectory-worker
ENTRYPOINT ["trajectory-worker"]
