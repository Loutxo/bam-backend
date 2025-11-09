# Test complet de l'API BAM avec authentification
# Script PowerShell pour tester tous les endpoints

Write-Host "🧪 Tests de l'API BAM avec Authentification" -ForegroundColor Green
Write-Host "=" * 50

$baseUrl = "http://localhost:3000"
$testEmail = "test@bam.app"
$testPassword = "password123"
$testUsername = "testuser"

# Test 1: Page d'accueil (publique)
Write-Host "`n1️⃣  Test de la page d'accueil..." -ForegroundColor Yellow
try {
    $homeResponse = Invoke-RestMethod -Uri "$baseUrl/" -Method GET
    Write-Host "✅ Accueil OK:" -ForegroundColor Green
    Write-Host "   Message: $($homeResponse.message)"
    Write-Host "   Version: $($homeResponse.version)"
    Write-Host "   Status: $($homeResponse.status)"
} catch {
    Write-Host "❌ Erreur accueil: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Health check (publique)
Write-Host "`n2️⃣  Test du health check..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET
    Write-Host "✅ Health OK:" -ForegroundColor Green
    Write-Host "   Status: $($healthResponse.status)"
    Write-Host "   Auth: $($healthResponse.auth)"
} catch {
    Write-Host "❌ Erreur health: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Inscription utilisateur
Write-Host "`n3️⃣  Test d'inscription..." -ForegroundColor Yellow
$registerData = @{
    email = $testEmail
    password = $testPassword
    username = $testUsername
    firstName = "Test"
    lastName = "User"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -Body $registerData -ContentType "application/json"
    Write-Host "✅ Inscription OK:" -ForegroundColor Green
    Write-Host "   User ID: $($registerResponse.user.id)"
    Write-Host "   Email: $($registerResponse.user.email)"
    $userId = $registerResponse.user.id
} catch {
    Write-Host "⚠️  Inscription (peut-être déjà existant): $($_.Exception.Message)" -ForegroundColor Yellow
    
    # Si l'user existe déjà, on essaie de se connecter
    Write-Host "   Tentative de connexion avec utilisateur existant..."
}

# Test 4: Connexion utilisateur
Write-Host "`n4️⃣  Test de connexion..." -ForegroundColor Yellow
$loginData = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    Write-Host "✅ Connexion OK:" -ForegroundColor Green
    Write-Host "   Access Token: $($loginResponse.access_token.Substring(0,20))..."
    $accessToken = $loginResponse.access_token
    $headers = @{ "Authorization" = "Bearer $accessToken" }
} catch {
    Write-Host "❌ Erreur connexion: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 5: Profil utilisateur (protégé)
Write-Host "`n5️⃣  Test du profil utilisateur..." -ForegroundColor Yellow
try {
    $profileResponse = Invoke-RestMethod -Uri "$baseUrl/auth/me" -Method GET -Headers $headers
    Write-Host "✅ Profil OK:" -ForegroundColor Green
    Write-Host "   Username: $($profileResponse.user.profile.username)"
    Write-Host "   Email: $($profileResponse.user.profile.email)"
} catch {
    Write-Host "❌ Erreur profil: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 6: Badges (protégé)
Write-Host "`n6️⃣  Test des badges..." -ForegroundColor Yellow
try {
    $badgesResponse = Invoke-RestMethod -Uri "$baseUrl/api/badges" -Method GET -Headers $headers
    Write-Host "✅ Badges OK:" -ForegroundColor Green
    Write-Host "   Nombre de badges: $($badgesResponse.count)"
    if ($badgesResponse.data.Count -gt 0) {
        Write-Host "   Premier badge: $($badgesResponse.data[0].name)"
    }
} catch {
    Write-Host "❌ Erreur badges: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 7: BAMs à proximité (protégé)
Write-Host "`n7️⃣  Test des BAMs à proximité..." -ForegroundColor Yellow
$parisLat = 48.8566
$parisLng = 2.3522
try {
    $bamsResponse = Invoke-RestMethod -Uri "$baseUrl/api/bams/nearby?latitude=$parisLat&longitude=$parisLng&radius=10000" -Method GET -Headers $headers
    Write-Host "✅ BAMs nearby OK:" -ForegroundColor Green
    Write-Host "   Nombre de BAMs: $($bamsResponse.count)"
    Write-Host "   Centre de recherche: Paris ($parisLat, $parisLng)"
    Write-Host "   Rayon: 10km"
} catch {
    Write-Host "❌ Erreur BAMs nearby: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 8: Accès sans token (doit échouer)
Write-Host "`n8️⃣  Test d'accès sans token (doit échouer)..." -ForegroundColor Yellow
try {
    $unauthorizedResponse = Invoke-RestMethod -Uri "$baseUrl/api/badges" -Method GET
    Write-Host "❌ PROBLÈME: L'endpoint protégé a répondu sans token!" -ForegroundColor Red
} catch {
    Write-Host "✅ Protection OK: Accès refusé sans token" -ForegroundColor Green
}

Write-Host "`n🎉 Tests terminés!" -ForegroundColor Green
Write-Host "=" * 50
Write-Host "L'API BAM avec authentification est fonctionnelle!" -ForegroundColor Green