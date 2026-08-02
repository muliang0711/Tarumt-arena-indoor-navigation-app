FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /out/presence-gateway ./cmd/presence-gateway

FROM alpine:3.22
RUN adduser -D -u 10001 presence
USER presence
COPY --from=build /out/presence-gateway /usr/local/bin/presence-gateway
ENTRYPOINT ["presence-gateway"]
