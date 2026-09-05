#!/bin/bash
# Setup script for local DynamoDB

echo "Starting local DynamoDB..."
docker run -d -p 8001:8000 --name dynamodb-local amazon/dynamodb-local

echo "Waiting for DynamoDB to start..."
sleep 2

echo "Creating WarrantyComplaintHub table..."

aws dynamodb create-table \
  --table-name WarrantyComplaintHub \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=SerialNumber,AttributeType=S \
    AttributeName=Status,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes \
    '[{
      "IndexName": "SerialNumberIndex",
      "KeySchema": [
        {"AttributeName": "SerialNumber", "KeyType": "HASH"},
        {"AttributeName": "SK", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    },
    {
      "IndexName": "StatusIndex",
      "KeySchema": [
        {"AttributeName": "Status", "KeyType": "HASH"},
        {"AttributeName": "SK", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }]' \
  --endpoint-url http://localhost:8001

echo "DynamoDB table created successfully!"
echo "DynamoDB running on: http://localhost:8001"
echo "You can verify the table with:"
echo "  aws dynamodb list-tables --endpoint-url http://localhost:8001"
