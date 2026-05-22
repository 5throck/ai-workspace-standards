param(
    [string]$TargetDir = ""
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if ([string]::IsNullOrWhiteSpace($TargetDir)) {
    $TargetDir = Read-Host "Enter the target directory for the new project (e.g., C:\git\my_new_project)"
}

if (Test-Path $TargetDir) {
    Write-Host "Directory already exists: $TargetDir" -ForegroundColor Red
    exit 1
}

$ProjectName = Read-Host "Enter the Project Name"
$ProjectDescription = Read-Host "Enter a one-sentence Project Description"
$ProjectCharacteristics = Read-Host "Enter the Project Characteristics (Features/Goals)"

Write-Host "Creating project in $TargetDir..."
New-Item -ItemType Directory -Path $TargetDir | Out-Null

# Copy all files except create-project.ps1 and create-project.sh
Get-ChildItem -Path $scriptDir -Exclude "create-project.*" | Copy-Item -Destination $TargetDir -Recurse -Force

$readmePath = Join-Path $TargetDir "README.md"
$readmeKoPath = Join-Path $TargetDir "README_ko.md"

function Replace-Placeholders {
    param([string]$FilePath)
    if (Test-Path $FilePath) {
        $content = Get-Content $FilePath -Raw
        $content = $content -replace '\{\{PROJECT_NAME\}\}', $ProjectName
        $content = $content -replace '\{\{PROJECT_DESCRIPTION\}\}', $ProjectDescription
        $content = $content -replace '\{\{PROJECT_CHARACTERISTICS\}\}', $ProjectCharacteristics
        Set-Content -Path $FilePath -Value $content -Encoding UTF8
    }
}

Write-Host "Generating README.md and README_ko.md with project details..."
Replace-Placeholders -FilePath $readmePath
Replace-Placeholders -FilePath $readmeKoPath

Write-Host "Project successfully created at $TargetDir!" -ForegroundColor Green
