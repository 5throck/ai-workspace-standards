
import fs from 'fs';
import path from 'path';

const variants = ['co-develop', 'co-design', 'co-security', 'co-work'];
const basePath = 'C:\\git\\templates';

variants.forEach(variant => {
  const readmePath = path.join(basePath, variant, 'README.md');
  if (fs.existsSync(readmePath)) {
    let content = fs.readFileSync(readmePath, 'utf8');
    if (!content.includes('content_hash:')) {
      content = content.replace(/^---([\s\S]*?)\r?\n---/, (match, p1) => {
        return '---' + p1 + '\ncontent_hash: TBD\n---';
      });
      fs.writeFileSync(readmePath, content, 'utf8');
      console.log('Updated ' + readmePath);
    }
  }

  const readmeKoPath = path.join(basePath, variant, 'README_ko.md');
  if (fs.existsSync(readmeKoPath)) {
    let content = fs.readFileSync(readmeKoPath, 'utf8');
    if (!content.includes('translated_from_hash:')) {
      content = content.replace(/^---([\s\S]*?)\r?\n---/, (match, p1) => {
        return '---' + p1 + '\ntranslated_from_hash: TBD\n---';
      });
      fs.writeFileSync(readmeKoPath, content, 'utf8');
      console.log('Updated ' + readmeKoPath);
    }
  }
});

