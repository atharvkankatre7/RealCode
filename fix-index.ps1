# PowerShell script to fix the MongoDB index issue
$RENDER_URL = "https://realcode.onrender.com"

Write-Host "Fixing MongoDB index issue..." -ForegroundColor Cyan
Write-Host "Calling: $RENDER_URL/api/admin/fix-index" -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$RENDER_URL/api/admin/fix-index" -Method POST -ContentType "application/json"
    Write-Host "Success! Index fix completed." -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor White
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host "Check your Render logs to see the admin operation." -ForegroundColor Cyan
