FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /out/analytics-api ./cmd/analytics-api

FROM alpine:3.22
RUN adduser -D -u 10001 analytics
USER analytics
COPY --from=build /out/analytics-api /usr/local/bin/analytics-api
ENTRYPOINT ["analytics-api"]
