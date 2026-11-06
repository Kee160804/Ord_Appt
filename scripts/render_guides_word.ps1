$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $projectRoot 'docs\user-guides'
$outputDir = Join-Path $projectRoot '.docx-qa\pdf'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

$word = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0

    Get-ChildItem -LiteralPath $sourceDir -Filter '*.docx' | ForEach-Object {
        $document = $null
        try {
            $document = $word.Documents.Open($_.FullName, $false, $true)
            $pdfPath = Join-Path $outputDir ($_.BaseName + '.pdf')
            $document.ExportAsFixedFormat($pdfPath, 17)
            Write-Output $pdfPath
        }
        finally {
            if ($null -ne $document) {
                $document.Close(0)
                [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($document)
            }
        }
    }
}
finally {
    if ($null -ne $word) {
        $word.Quit()
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
