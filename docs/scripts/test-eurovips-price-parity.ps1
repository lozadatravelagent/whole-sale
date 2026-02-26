param(
  [string]$Endpoint = "https://ujigyazketblwlzcomve.supabase.co/functions/v1/eurovips-soap",
  [string]$AnonKey = "",
  [string]$CityCode = "PUJ",
  [string]$CheckinDate = "2026-05-07",
  [string]$CheckoutDate = "2026-05-14",
  [string]$HotelNameFilter = "CATALONIA",
  [string]$TargetHotelContains = "CATALONIA BAVARO BEACH GOLF",
  [string]$TargetRoomContains = "Privileged Deluxe Junior Suite",
  [int]$Adults = 1,
  [int]$Children = 1,
  [int[]]$ChildrenAges = @(8),
  [ValidateSet("CNN", "CHD")][string]$ChildType = "CNN",
  [int]$Infants = 0,
  [double]$ExpectedPortalNet = 1310.08,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($AnonKey)) {
  $AnonKey = $env:SUPABASE_ANON_KEY
}
if ([string]::IsNullOrWhiteSpace($AnonKey)) {
  # Same public anon key currently used by frontend service calls.
  $AnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaWd5YXprZXRibHdsemNvbXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3ODk2MTEsImV4cCI6MjA3MjM2NTYxMX0.X6YvJfgQnCAzFXa37nli47yQxuRG-7WJnJeIDrqg5EA"
}

function Invoke-CurlJson {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$Token,
    [Parameter(Mandatory = $true)][string]$BodyJson
  )

  $args = @(
    "-sS",
    "-X", "POST",
    $Url,
    "-H", "Content-Type: application/json",
    "-H", "Authorization: Bearer $Token",
    "--data-raw", $BodyJson
  )

  if ($DryRun) {
    Write-Host "curl.exe $($args -join ' ')"
    return $null
  }

  $raw = & curl.exe @args
  if ($LASTEXITCODE -ne 0) {
    throw "curl.exe failed with exit code $LASTEXITCODE"
  }

  try {
    return $raw | ConvertFrom-Json -Depth 100
  } catch {
    Write-Host "Raw response was not valid JSON:"
    Write-Host $raw
    throw
  }
}

$searchPayload = @{
  action = "searchHotels"
  data = @{
    cityCode = $CityCode
    checkinDate = $CheckinDate
    checkoutDate = $CheckoutDate
    hotelName = $HotelNameFilter
    adults = $Adults
    children = $Children
    childrenAges = $ChildrenAges
    infants = $Infants
  }
} | ConvertTo-Json -Depth 20 -Compress

Write-Host ""
Write-Host "=== STEP 1: searchHotels ==="
$searchResponse = Invoke-CurlJson -Url $Endpoint -Token $AnonKey -BodyJson $searchPayload
if ($DryRun) { exit 0 }

if (-not $searchResponse.success) {
  throw "searchHotels failed: $($searchResponse.error)"
}

$hotels = @($searchResponse.results)
if ($hotels.Count -eq 0) {
  throw "searchHotels returned 0 hotels"
}

$targetHotel = $hotels | Where-Object { $_.name -like "*$TargetHotelContains*" } | Select-Object -First 1
if (-not $targetHotel) {
  throw "Target hotel not found. Contains filter: $TargetHotelContains"
}

$targetRoom = @($targetHotel.rooms) | Where-Object {
  $_.description -and $_.description -like "*$TargetRoomContains*" -and $_.fare_id_broker
} | Select-Object -First 1

if (-not $targetRoom) {
  throw "Target room not found with fare_id_broker. Contains filter: $TargetRoomContains"
}

Write-Host "Hotel: $($targetHotel.name)"
Write-Host "Room : $($targetRoom.description)"
Write-Host "Child type  : $ChildType"
Write-Host "fareId      : $($targetHotel.unique_id)"
Write-Host "fareIdBroker: $($targetRoom.fare_id_broker)"
Write-Host "occupancyId : $($targetRoom.xml_occupancy_id)"

$passengers = @()
for ($i = 0; $i -lt $Adults; $i++) {
  $passengers += @{ type = "ADT" }
}
for ($i = 0; $i -lt $Children; $i++) {
  $age = if ($i -lt $ChildrenAges.Count) { $ChildrenAges[$i] } else { 8 }
  $passengers += @{ type = $ChildType; age = $age }
}
for ($i = 0; $i -lt $Infants; $i++) {
  $passengers += @{ type = "INF"; age = 1 }
}

$makeBudgetPayload = @{
  action = "makeBudget"
  data = @{
    fareId = $targetHotel.unique_id
    fareIdBroker = $targetRoom.fare_id_broker
    checkinDate = $CheckinDate
    checkoutDate = $CheckoutDate
    occupancies = @(
      @{
        occupancyId = if ($targetRoom.xml_occupancy_id) { $targetRoom.xml_occupancy_id } else { $targetRoom.occupancy_id }
        passengers = $passengers
      }
    )
  }
} | ConvertTo-Json -Depth 30 -Compress

Write-Host ""
Write-Host "=== STEP 2: makeBudget ==="
$budgetResponse = Invoke-CurlJson -Url $Endpoint -Token $AnonKey -BodyJson $makeBudgetPayload

if (-not $budgetResponse.success) {
  throw "makeBudget failed: $($budgetResponse.error)"
}

$results = $budgetResponse.results
if (-not $results.success) {
  throw "makeBudget business error: $($results.error)"
}

$net = [double]($results.agencyPricing.netoAgencia)
$gross = [double]($results.agencyPricing.importeBruto)
$commission = [double]($results.agencyPricing.comision)

Write-Host "budgetId : $($results.budgetId)"
Write-Host "Gross    : $gross"
Write-Host "Commission: $commission"
Write-Host "Net (API): $net"
Write-Host "Net (Portal expected): $ExpectedPortalNet"

$delta = [Math]::Round(($net - $ExpectedPortalNet), 2)
Write-Host "Delta (API - Portal): $delta"

if ([Math]::Abs($delta) -le 0.01) {
  Write-Host "PARITY OK"
  exit 0
}

Write-Host "PARITY MISMATCH"
exit 2
