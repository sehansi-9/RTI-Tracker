package client

import (
	"context"
	"net/http"
	"time"

	"github.com/hashicorp/go-retryablehttp"
)

// API Client struct
type Client struct {
	IngestionURL string
	ReadURL      string
	HttpClient   *retryablehttp.Client
}

// Custom Retry Check
func customRetryCheck(ctx context.Context, resp *http.Response, err error) (bool, error) {
	if resp != nil {
		switch resp.StatusCode {
		case http.StatusBadRequest, http.StatusNotFound, http.StatusConflict:
			return false, nil
		}
	}

	return retryablehttp.DefaultRetryPolicy(ctx, resp, err)
}

// API Client
func ApiClient(ingesUrl string, reUrl string) *Client {
	retryClient := retryablehttp.NewClient()
	retryClient.RetryMax = 10
	retryClient.RetryWaitMin = 1 * time.Second
	retryClient.RetryWaitMax = 6 * time.Second
	retryClient.CheckRetry = customRetryCheck
	retryClient.Logger = nil

	return &Client{
		IngestionURL: ingesUrl,
		ReadURL:      reUrl,
		HttpClient:   retryClient,
	}
}
