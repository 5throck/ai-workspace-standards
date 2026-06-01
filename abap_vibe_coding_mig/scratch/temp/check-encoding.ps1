$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
Get-ChildItem -Filter *.md -Recurse | ForEach-Object {
    $path = $_.FullName
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $isUtf8 = $true
    try {
        $enc = New-Object System.Text.UTF8Encoding($false, $true)
        $null = $enc.GetString($bytes)
    } catch {
        $isUtf8 = $false
    }
    
    $relative = $_.FullName.Replace("c:\git\abap\", "")
    if ($isUtf8) {
        Write-Host "$relative : UTF-8"
    } else {
        Write-Host "$relative : NOT UTF-8 (Error!)" -ForegroundColor Red
    }
}
