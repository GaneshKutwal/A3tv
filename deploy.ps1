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
    6. Build frontend client assets for the configured hosting target
      7. Invalidate CloudFront cache
.PREREQUISITES
    - AWS CLI installed and configured (aws configure)
    - Python 3.11 installed
    - Node.js / npm installed
    - Docker Desktop running
.USAGE
    .\deploy.ps1 -StackName "A3TV-WarrantyHub" -CognitoUserEmail "employee@a3tv.com" -CognitoTemporaryPassword "..."
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$StackName = "A3TV-WarrantyHub",

    [Parameter(Mandatory=$false)]
    [string]$AwsRegion = "ap-south-1",

    [Parameter(Mandatory=$false)]
    [string]$Environment = "production",

    [Parameter(Mandatory=$false)]
    [string]$DynamoDBTableName = "WarrantyComplaintHub",

    [Parameter(Mandatory=$false)]
    [string]$CognitoUserEmail,

    [Parameter(Mandatory=$false)]
    [string]$CognitoTemporaryPassword
)

# ── Colour helpers ────────────────────────────────────────────────────────────
function Write-Step  { param($msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK    { param($msg) Write-Host "    OK  $msg" -ForegroundColor Green }
function Write-Fail  { param($msg) Write-Host "    ERR $msg" -ForegroundColor Red; exit 1 }
function Write-Info  { param($msg) Write-Host "    ... $msg" -ForegroundColor Gray }

$ErrorActionPreference = "Stop"

if ($CognitoTemporaryPassword -and $CognitoTemporaryPassword -notmatch '[A-Z]') {
    Write-Fail "CognitoTemporaryPassword must include an uppercase letter, lowercase letter, number, and symbol."
}

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
$LambdaVersion = [DateTime]::UtcNow.ToString("yyyyMMddHHmmss")
$LambdaS3Key   = "backend/lambda-$LambdaVersion.zip"

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
$ErrorActionPreference = "Continue"
$BucketExists = aws s3api head-bucket --bucket $StagingBucket 2>$null
$BucketExitCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"
if ($BucketExitCode -ne 0) {
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
# STEP 2 - Package Lambda (Linux dependencies via Docker + zip)
# ════════════════════════════════════════════════════════════════════════════
Write-Step "Step 2/7 - Packaging Lambda function"

# Clean previous build
if (Test-Path $PackageDir) { Remove-Item -Recurse -Force $PackageDir }
if (Test-Path $ZipFile)    { Remove-Item -Force $ZipFile }
New-Item -ItemType Directory -Path $PackageDir | Out-Null

Write-Info "Checking Docker ..."
if (!(Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Fail "Docker CLI not found. Install Docker Desktop and try again."
}
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Docker is not running. Start Docker Desktop and try again."
}

$LambdaBuildImage = "public.ecr.aws/sam/build-python3.11:latest"
Write-Info "Installing Linux-compatible Python dependencies with Docker ..."
docker run --rm --platform linux/amd64 `
    -v "${PackageDir}:/asset-output" `
    -v "${BackendDir}:/var/task:ro" `
    $LambdaBuildImage `
    bash -lc "pip install --no-cache-dir -r /var/task/requirements.txt -t /asset-output"
if ($LASTEXITCODE -ne 0) { Write-Fail "Docker dependency installation failed" }

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

$ErrorActionPreference = "Continue"
$StackExists = aws cloudformation describe-stacks --stack-name $StackName --region $AwsRegion 2>$null
$StackExitCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"
$Action = if ($StackExitCode -eq 0) { "update-stack" } else { "create-stack" }

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
$CognitoUserPoolId   = Get-StackOutput "CognitoUserPoolId"
$CognitoClientId     = Get-StackOutput "CognitoClientId"

Write-OK "API Gateway URL:   $ApiGatewayUrl"
Write-OK "Frontend URL:      $FrontendUrl"
Write-OK "Frontend S3 Bucket: $FrontendBucketName"
Write-OK "Cognito User Pool:  $CognitoUserPoolId"
Write-OK "Cognito App Client: $CognitoClientId"

if ($CognitoUserEmail -and $CognitoTemporaryPassword) {
    Write-Step "Creating or resetting Cognito employee: $CognitoUserEmail"
    $ErrorActionPreference = "Continue"
    $PoolUser = aws cognito-idp admin-get-user --user-pool-id $CognitoUserPoolId --username $CognitoUserEmail --region $AwsRegion 2>$null
    $PoolUserExitCode = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    if ($PoolUserExitCode -eq 0) {
        aws cognito-idp admin-set-user-password --user-pool-id $CognitoUserPoolId --username $CognitoUserEmail --password $CognitoTemporaryPassword --permanent --region $AwsRegion
    } else {
        aws cognito-idp admin-create-user --user-pool-id $CognitoUserPoolId --username $CognitoUserEmail --user-attributes Name=email,Value=$CognitoUserEmail Name=email_verified,Value=true --temporary-password $CognitoTemporaryPassword --message-action SUPPRESS --region $AwsRegion
        if ($LASTEXITCODE -eq 0) {
            aws cognito-idp admin-set-user-password --user-pool-id $CognitoUserPoolId --username $CognitoUserEmail --password $CognitoTemporaryPassword --permanent --region $AwsRegion
        }
    }
    if ($LASTEXITCODE -ne 0) { Write-Fail "Cognito employee setup failed" }
    Write-OK "Cognito employee is ready"
}


# ════════════════════════════════════════════════════════════════════════════
# STEP 6 - Build Frontend with real API URL
# ════════════════════════════════════════════════════════════════════════════
Write-Step "Step 6/7 - Building React frontend"

# Write production .env for Vite
$EnvContent = @"
VITE_API_BASE_URL=$ApiGatewayUrl
VITE_AUTH_MODE=cognito
VITE_COGNITO_REGION=$AwsRegion
VITE_COGNITO_USER_POOL_ID=$CognitoUserPoolId
VITE_COGNITO_CLIENT_ID=$CognitoClientId
"@
Set-Content -Path "$FrontendDir\.env.production" -Value $EnvContent
Write-Info "Wrote .env.production: $EnvContent"

Write-Info "Running npm install ..."
Set-Location $FrontendDir
npm install --silent
if ($LASTEXITCODE -ne 0) { Write-Fail "npm install failed" }

Write-Info "Running Vite build ..."
$ViteCli = Join-Path $FrontendDir "node_modules\vite\bin\vite.js"
node $ViteCli build
if ($LASTEXITCODE -ne 0) { Write-Fail "Vite build failed" }
if (!(Test-Path $BuildDir)) {
    Write-Fail "Frontend build output not found at $BuildDir"
}
if (!(Test-Path (Join-Path $BuildDir "index.html"))) {
    Write-Fail "Frontend build did not produce dist\index.html"
}
Write-OK "Frontend built in $BuildDir"

# Upload static frontend files to the frontend S3 bucket
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
Write-Host "  Login: use a verified Cognito user" -ForegroundColor Cyan
Write-Host ""
Write-Host "  NOTE: CloudFront takes 5-10 minutes to propagate globally." -ForegroundColor Gray
Write-Host "  If the frontend looks blank, wait and hard-refresh (Ctrl+Shift+R)." -ForegroundColor Gray
Write-Host ""
