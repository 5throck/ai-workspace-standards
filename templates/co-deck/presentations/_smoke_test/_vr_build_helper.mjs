
    import { buildThemeDeck } from 'C:/git/ai_workspace/templates/co-deck/scripts/co-deck/lib/theme-builder.ts';
    const opts = {"root":"C:\\git\\ai_workspace\\templates\\co-deck","projectPath":"C:\\git\\ai_workspace\\templates\\co-deck\\presentations\\_smoke_test","theme":"zen","style":"minimal","title":"Visual Regression — zen × minimal","slideData":[{"headline":"Smoke Test Cover","type":"cover","bullets":["Test bullet one","Test bullet two"]},{"headline":"Smoke Test Content","type":"standard","bullets":["Point A","Point B","Point C"],"visualTitle":"Visual Title","visualDisplay":"Visual display text"},{"headline":"Smoke Test Divider","type":"divider","bullets":[]},{"headline":"Smoke Test Punchline","type":"punchline","bullets":["Key takeaway"]}],"outputPath":"C:\\git\\ai_workspace\\templates\\co-deck\\presentations\\_smoke_test\\vr_zen_minimal.html"};
    const result = buildThemeDeck(opts);
    console.log('%%BUILD_START%%');
    console.log(JSON.stringify({ outputPath: result.outputPath, html: result.html, warnings: result.warnings, errors: result.errors }));
    console.log('%%BUILD_END%%');
  