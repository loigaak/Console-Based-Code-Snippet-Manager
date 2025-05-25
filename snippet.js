#!/usr/bin/env node

const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const Fuse = require('fuse.js');
const clipboardy = require('clipboardy');

// Snippet storage
const SNIPPET_FILE = path.join(process.env.HOME || process.env.USERPROFILE, '.snippets.json');

// Load snippets
async function loadSnippets() {
  try {
    return await fs.readJson(SNIPPET_FILE);
  } catch {
    return [];
  }
}

// Save snippets
async function saveSnippets(snippets) {
  await fs.writeJson(SNIPPET_FILE, snippets, { spaces: 2 });
  console.log(chalk.green('Snippets saved!'));
}

// Add snippet
async function addSnippet() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'title',
      message: 'Snippet title:',
      validate: input => (input ? true : 'Title is required'),
    },
    {
      type: 'input',
      name: 'code',
      message: 'Enter code (press Enter twice to finish):',
      type: 'editor',
    },
    {
      type: 'input',
      name: 'language',
      message: 'Language (e.g., javascript, python):',
      default: 'javascript',
    },
    {
      type: 'input',
      name: 'tags',
      message: 'Tags (comma-separated, e.g., react, api):',
      filter: input => input.split(',').map(tag => tag.trim()).filter(tag => tag),
    },
    {
      type: 'input',
      name: 'category',
      message: 'Category (e.g., React, Node.js):',
      default: 'General',
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description (optional):',
    },
  ]);

  const snippets = await loadSnippets();
  snippets.push({
    id: snippets.length + 1,
    ...answers,
    createdAt: new Date().toISOString(),
  });

  await saveSnippets(snippets);
  console.log(chalk.green(`Snippet "${answers.title}" added!`));
}

// Search snippets
async function searchSnippets(query) {
  const snippets = await loadSnippets();
  const fuse = new Fuse(snippets, {
    keys: ['title', 'code', 'tags', 'description', 'language', 'category'],
    threshold: 0.3,
  });

  const results = fuse.search(query).map(result => result.item);
  if (!results.length) {
    console.log(chalk.yellow('No snippets found.'));
    return;
  }

  results.forEach(snippet => {
    console.log(chalk.cyan(`[${snippet.id}] ${snippet.title} (${snippet.language})`));
    console.log(`  Category: ${snippet.category}`);
    console.log(`  Tags: ${snippet.tags.join(', ')}`);
    console.log(`  Description: ${snippet.description || 'None'}`);
    console.log(`  Code:\n${snippet.code}`);
    console.log('---');
  });

  const { copyId } = await inquirer.prompt([
    {
      type: 'input',
      name: 'copyId',
      message: 'Enter snippet ID to copy to clipboard (or press Enter to skip):',
    },
  ]);

  if (copyId) {
    const snippet = snippets.find(s => s.id === parseInt(copyId));
    if (snippet) {
      clipboardy.writeSync(snippet.code);
      console.log(chalk.green(`Snippet "${snippet.title}" copied to clipboard!`));
    } else {
      console.log(chalk.red('Invalid snippet ID.'));
    }
  }
}

// List snippets
async function listSnippets(options) {
  const snippets = await loadSnippets();
  let filtered = snippets;

  if (options.lang) {
    filtered = filtered.filter(s => s.language.toLowerCase() === options.lang.toLowerCase());
  }
  if (options.category) {
    filtered = filtered.filter(s => s.category.toLowerCase() === options.category.toLowerCase());
  }

  if (!filtered.length) {
    console.log(chalk.yellow('No snippets found.'));
    return;
  }

  filtered.forEach(snippet => {
    console.log(chalk.cyan(`[${snippet.id}] ${snippet.title} (${snippet.language})`));
    console.log(`  Category: ${snippet.category}`);
    console.log(`  Tags: ${snippet.tags.join(', ')}`);
    console.log('---');
  });
}

// Export snippets
async function exportSnippets(format) {
  const snippets = await loadSnippets();
  if (format === 'json') {
    await fs.writeJson(path.join(process.cwd(), 'snippets-export.json'), snippets, { spaces: 2 });
    console.log(chalk.green('Snippets exported to snippets-export.json'));
  } else if (format === 'markdown') {
    let markdown = '# Code Snippets\n\n';
    snippets.forEach(snippet => {
      markdown += `## ${snippet.title}\n`;
      markdown += `- **Language**: ${snippet.language}\n`;
      markdown += `- **Category**: ${snippet.category}\n`;
      markdown += `- **Tags**: ${snippet.tags.join(', ')}\n`;
      markdown += `- **Description**: ${snippet.description || 'None'}\n`;
      markdown += '```' + snippet.language + '\n' + snippet.code + '\n```\n\n';
    });
    await fs.writeFile(path.join(process.cwd(), 'snippets-export.md'), markdown);
    console.log(chalk.green('Snippets exported to snippets-export.md'));
  } else {
    console.log(chalk.red('Unsupported format. Use "json" or "markdown".'));
  }
}

program
  .command('add')
  .description('Add a new code snippet')
  .action(() => addSnippet());

program
  .command('search <query>')
  .description('Search snippets by keyword')
  .action(query => searchSnippets(query));

program
  .command('list')
  .description('List snippets')
  .option('--lang <language>', 'Filter by language')
  .option('--category <category>', 'Filter by category')
  .action(options => listSnippets(options));

program
  .command('export <format>')
  .description('Export snippets to JSON or Markdown')
  .action(format => exportSnippets(format));

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
  console.log(chalk.cyan('Use the "add" command to start managing snippets!'));
}
