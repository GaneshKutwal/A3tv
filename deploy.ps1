<#
.SYNOPSIS
    Deploy A3 Television Warranty & Complaint Hub to AWS
.DESCRIPTION
    Automates full deployment:
      1. Package backend Python code into lambda.zip
      2. Upload zip to a staging S3 bucket
      3. Deploy / update CloudFormation stack
      4. Read API Gateway URL from stack outputs
      5. Build React frontend with the correct API URL
      6. Upload frontend dist/ to S3
      7. Invalidate CloudFront cache
.PREREQUISITES
    - AWS CLI installed and configured (aws configure)
    - Python 3.11 installed
    - Node.js / npm installed
    - pip installed
.USAGE
    .\deploy.ps1 -StackName "a3tv-warranty-hub" -AwsRegion "us-east-1" -JWTSecret "your-strong-secret-here"
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$StackName = "a3tv-warranty-hub",

    [Parameter(Mandatory=$false)]
    [string]$AwsRegion = "us-east-1",

    [Parameter(Mandatory=$true)]
    [string]$JWTSecret,

    [Parameter(Mandatory=$false)]
    [string]$Environment = "production",

    [Parameter(Mandatory=$false)]
    [string]$DynamoDBTableName = "WarrantyComplaintHub"
)

# ── Colour helpers ────────────────────────────────────────────────────────────
function Write-Step  { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK    { param($msg) Write-Host "    OK  $msg" -ForegroundColor Green }
function Write-Fail  { param($msg) Write-Host "    ERR $msg" -ForegroundColor Red; exit 1 }
function Write-Info  { param($msg) Write-Host "    ... $msg" -ForegroundColor Gray }

$ErrorActionPreference = "Stop"

# ── Paths ────────────────────────────────────────────────────────────────────
$ProjectRoot  = $PSScriptRoot
$BackendDir   = Join-Path $ProjectRoot "backend"
$FrontendDir  = Join-Path $ProjectRoot "warranty-complaint-hub"
$BuildDir     = Join-Path $FrontendDir "dist"
$PackageDir   = Join-Path $ProjectRoot ".lambda_package"
$ZipFile      = Join-Path $ProjectRoot "lambda.zip"
$CfnTemplate  = Join-Path $ProjectRoot "cloudformation.yaml"

# ── Derive a unique staging bucket name (max 63 chars) ───────────────────────
$AwsAccountId = (aws sts get-caller-identity --query Account --output text 2>$null)
if (!$AwsAccountId) { Write-Fail "AWS CLI not configured. Run 'aws configure' first." }
$StagingBucket = "a3tv-deploy-$AwsAccountId"
$LambdaS3Key   = "backend/lambda.zip"

Write-Host "`n==========================================" -ForegroundColor Magenta
Write-Host "  A3TV Warranty Hub - AWS Deployment" -ForegroundColor Magenta
Write-Host "  Stack:   $StackName" -ForegroundColor Magenta
Write-Host "  Region:  $AwsRegion" -ForegroundColor Magenta
Write-Host "  Account: $AwsAccountId" -ForegroundColor Magenta
Write-Host "==========================================" -ForegroundColor Magenta


# ════════════════════════════════════════════════════════════════════════════
# STEP 1 - Create staging S3 bucket (if it doesn't exist)
# ════════════════════════════════════════════════════════════════════════════
Write-Step "Step 1/7 - Ensuring staging S3 bucket exists: $StagingBucket"
$BucketExists = aws s3api head-bucket --bucket $StagingBucket 2>&1
if ($LASTEXITCODE -ne 0) {
    if ($AwsRegion -eq "us-east-1") {
        aws s3api create-bucket --bucket $StagingBucket --region $AwsRegion | Out-Null
    } else {
        aws s3api create-bucket --bucket $StagingBucket --region $AwsRegion `
            --create-bucket-configuration LocationConstraint=$AwsRegion | Out-Null
    }
    Write-OK "Created bucket: $StagingBucket"
} else {
    Write-OK "Bucket already exists: $StagingBucket"
}


# ════════════════════════════════════════════════════════════════════════════
# STEP 2 - Package Lambda (pip install + zip)
# ════════════════════════════════════════════════════════════════════════════
Write-Step "Step 2/7 - Packaging Lambda function"

# Clean previous build
if (Test-Path $PackageDir) { Remove-Item -Recurse -Force $PackageDir }
if (Test-Path $ZipFile)    { Remove-Item -Force $ZipFile }
New-Item -ItemType Directory -Path $PackageDir | Out-Null

Write-Info "Installing Python dependencies into .lambda_package/ ..."
pip install -r "$BackendDir\requirements.txt" -t $PackageDir --quiet
if ($LASTEXITCODE -ne 0) { Write-Fail "pip install failed" }

Write-Info "Copying backend source files ..."
# Copy all Python source files (exclude local dev files)
$excludeItems = @("__pycache__", "*.pyc", "uploads", ".env", ".env.production", "tests")
Get-ChildItem -Path $BackendDir -File | Where-Object {
    $_.Extension -in @(".py", ".txt", ".json") -and $_.Name -notin $excludeItems
} | Copy-Item -Destination $PackageDir

# Copy models/ and routers/ directories
foreach ($dir in @("models", "routers")) {
    $srcDir = Join-Path $BackendDir $dir
    if (Test-Path $srcDir) {
        Copy-Item -Recurse -Path $srcDir -Destination (Join-Path $PackageDir $dir) -Force
    }
}

Write-Info "Creating lambda.zip ..."
Compress-Archive -Path "$PackageDir\*" -DestinationPath $ZipFile -Force
$ZipSizeMB = [math]::Round((Get-Item $ZipFile).Length / 1MB, 1)
Write-OK "lambda.zip created ($ZipSizeMB MB)"


# ════════════════════════════════════════════════════════════════════════════
# STEP 3 - Upload Lambda zip to S3
# ════════════════════════════════════════════════════════════════════════════
Write-Step "Step 3/7 - Uploading lambda.zip to s3://$StagingBucket/$LambdaS3Key"
aws s3 cp $ZipFile "s3://$StagingBucket/$LambdaS3Key" --region $AwsRegion
if ($LASTEXITCODE -ne 0) { Write-Fail "Upload to S3 failed" }
Write-OK "Uploaded lambda.zip"


# ════════════════════════════════════════════════════════════════════════════
# STEP 4 - Deploy CloudFormation Stack
# ════════════════════════════════════════════════════════════════════════════
Write-Step "Step 4/7 - Deploying CloudFormation stack: $StackName"

$StackExists = aws cloudformation describe-stacks --stack-name $StackName --region $AwsRegion 2>&1
$Action = if ($LASTEXITCODE -eq 0) { "update-stack" } else { "create-stack" }

Write-Info "Action: $Action"

aws cloudformation $Action `
    --stack-name $StackName `
    --template-body "file://$CfnTemplate" `
    --region $AwsRegion `
    --capabilities CAPABILITY_NAMED_IAM `
    --parameters `
        ParameterKey=Environment,ParameterValue=$Environment `
        ParameterKey=LambdaCodeBucket,ParameterValue=$StagingBucket `
        ParameterKey=LambdaCodeKey,ParameterValue=$LambdaS3Key `
        ParameterKey=JWTSecret,ParameterValue=$JWTSecret `
        ParameterKey=DynamoDBTableName,ParameterValue=$DynamoDBTableName

if ($LASTEXITCODE -ne 0) { Write-Fail "CloudFormation $Action failed" }

Write-Info "Waiting for stack to complete (this takes 3-5 minutes for first deploy)..."
if ($Action -eq "create-stack") {
    aws cloudformation wait stack-create-complete --stack-name $StackName --region $AwsRegion
} else {
    aws cloudformation wait stack-update-complete --stack-name $StackName --region $AwsRegion
}
if ($LASTEXITCODE -ne 0) { Write-Fail "Stack deployment did not complete successfully. Check CloudFormation console." }
Write-OK "Stack deployed successfully"


# ════════════════════════════════════════════════════════════════════════════
# STEP 5 - Read stack outputs
# ════════════════════════════════════════════════════════════════════════════
Write-Step "Step 5/7 - Reading stack outputs"

$Outputs = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $AwsRegion `
    --query "Stacks[0].Outputs" `
    --output json | ConvertFrom-Json

function Get-StackOutput($key) {
    ($Outputs | Where-Object { $_.OutputKey -eq $key }).OutputValue
}

$ApiGatewayUrl       = Get-StackOutput "ApiGatewayUrl"
$FrontendUrl         = Get-StackOutput "FrontendUrl"
$FrontendBucketName  = Get-StackOutput "FrontendBucketName"
$CloudFrontDistId    = Get-StackOutput "CloudFrontDistributionId"

Write-OK "API Gateway URL:   $ApiGatewayUrl"
Write-OK "Frontend URL:      $FrontendUrl"
Write-OK "Frontend S3 Bucket: $FrontendBucketName"


# ════════════════════════════════════════════════════════════════════════════
# STEP 6 - Build Frontend with real API URL
# ════════════════════════════════════════════════════════════════════════════
Write-Step "Step 6/7 - Building React frontend"

# Write production .env for Vite
$EnvContent = "VITE_API_BASE_URL=$ApiGatewayUrl"
Set-Content -Path "$FrontendDir\.env.production" -Value $EnvContent
Write-Info "Wrote .env.production: $EnvContent"

Write-Info "Running npm install ..."
Set-Location $FrontendDir
npm install --silent
if ($LASTEXITCODE -ne 0) { Write-Fail "npm install failed" }

Write-Info "Running npm run build ..."
npm run build
if ($LASTEXITCODE -ne 0) { Write-Fail "npm run build failed" }
Write-OK "Frontend built in $BuildDir"

# Upload dist/ to frontend S3 bucket
Write-Info "Uploading dist/ to s3://$FrontendBucketName ..."
aws s3 sync $BuildDir "s3://$FrontendBucketName" `
    --delete `
    --region $AwsRegion `
    --cache-control "public,max-age=31536000,immutable" `
    --exclude "index.html"

# Upload index.html with no-cache (so SPA routing always gets fresh shell)
aws s3 cp "$BuildDir\index.html" "s3://$FrontendBucketName/index.html" `
    --region $AwsRegion `
    --cache-control "no-cache,no-store,must-revalidate"

if ($LASTEXITCODE -ne 0) { Write-Fail "Frontend upload to S3 failed" }
Write-OK "Frontend uploaded"


# ════════════════════════════════════════════════════════════════════════════
# STEP 7 - Invalidate CloudFront cache
# ════════════════════════════════════════════════════════════════════════════
Write-Step "Step 7/7 - Invalidating CloudFront cache"
aws cloudfront create-invalidation `
    --distribution-id $CloudFrontDistId `
    --paths "/*" `
    --region us-east-1 | Out-Null   # CloudFront is always us-east-1
Write-OK "Cache invalidation triggered"


# ════════════════════════════════════════════════════════════════════════════
# DONE
# ════════════════════════════════════════════════════════════════════════════
Set-Location $ProjectRoot

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  App URL (CloudFront):  $FrontendUrl" -ForegroundColor Yellow
Write-Host "  API URL (API Gateway): $ApiGatewayUrl" -ForegroundColor Yellow
Write-Host "  API Docs:              $ApiGatewayUrl/docs" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Login credentials:" -ForegroundColor Cyan
Write-Host "    employee1@a3tv.com / password123" -ForegroundColor White
Write-Host "    employee2@a3tv.com / password456" -ForegroundColor White
Write-Host ""
Write-Host "  NOTE: CloudFront takes 5-10 minutes to propagate globally." -ForegroundColor Gray
Write-Host "  If the frontend looks blank, wait and hard-refresh (Ctrl+Shift+R)." -ForegroundColor Gray
Write-Host ""
