const test = require('node:test');
const assert = require('node:assert/strict');
const { levenshtein, normalize, matchOption, matchYesNo } = require('./fuzzy');

const PLANS = ['3-Yr Comprehensive', 'Zero Dep + RSA', 'Engine Protect combo'];

test('levenshtein basic distances', () => {
  assert.equal(levenshtein('kitten', 'kitten'), 0);
  assert.equal(levenshtein('kitten', 'sitten'), 1);
  assert.equal(levenshtein('', 'abc'), 3);
});

test('normalize strips emoji, punctuation and case', () => {
  assert.equal(normalize('✅ Yes'), 'yes');
  assert.equal(normalize('Zero Dep + RSA'), 'zero dep rsa');
  assert.equal(normalize('➡️ No, go ahead'), 'no go ahead');
});

test('matchOption resolves an exact button-tap title', () => {
  assert.equal(matchOption('3-Yr Comprehensive', PLANS), '3-Yr Comprehensive');
  assert.equal(matchOption('Engine Protect combo', PLANS), 'Engine Protect combo');
});

test('matchOption tolerates typos in the distinctive word', () => {
  assert.equal(matchOption('comprehesive', PLANS), '3-Yr Comprehensive');
  assert.equal(matchOption('engin protect', PLANS), 'Engine Protect combo');
});

test('matchOption handles partial / shorthand answers', () => {
  assert.equal(matchOption('zero dep rsa', PLANS), 'Zero Dep + RSA');
  assert.equal(matchOption('rsa', PLANS), 'Zero Dep + RSA');
  assert.equal(matchOption('comprehensive', PLANS), '3-Yr Comprehensive');
});

test('matchOption returns null when nothing is close', () => {
  assert.equal(matchOption('make it in hindi', PLANS), null);
  assert.equal(matchOption('', PLANS), null);
});

test('matchYesNo reads yes variants incl. emoji and typos', () => {
  for (const s of ['✅ Yes', 'yes', 'yess', 'yeah', 'ya', 'sure', 'haan', 'ok']) {
    assert.equal(matchYesNo(s), 'yes', `expected yes for "${s}"`);
  }
});

test('matchYesNo reads no variants incl. emoji and proceed phrases', () => {
  for (const s of ['🙅 No', 'no', 'nope', 'nah', '➡️ No, go ahead', 'go ahead', 'proceed', 'nothing else']) {
    assert.equal(matchYesNo(s), 'no', `expected no for "${s}"`);
  }
});

test('matchYesNo returns null when unrecognised', () => {
  assert.equal(matchYesNo('maybe later'), null);
  assert.equal(matchYesNo(''), null);
});
