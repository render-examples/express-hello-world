const test = require('node:test');
const assert = require('node:assert/strict');
const flow2Session = require('./flow2Session');

const PLANS = ['3-Yr Comprehensive', 'Zero Dep + RSA', 'Engine Protect combo'];
const ctx = { plans: PLANS };

test('start asks the plan first, carrying customer/model into state', () => {
  const { state, action } = flow2Session.start({ customer: 'Apoorva', model: 'Grand Vitara' }, ctx);
  assert.equal(state.step, 'awaiting_plan');
  assert.equal(state.customer, 'Apoorva');
  assert.equal(state.model, 'Grand Vitara');
  assert.equal(action.type, 'ask');
  assert.deepEqual(action.options, PLANS);
});

test('full happy path: plan → contact → confirm → create (deterministic order)', () => {
  let { state, action } = flow2Session.start({ customer: 'Apoorva', model: 'Grand Vitara' }, ctx);
  assert.equal(action.step, 'awaiting_plan');

  // plan (typed with a typo)
  ({ state, action } = flow2Session.advance(state, 'comprehesive', ctx));
  assert.equal(state.step, 'awaiting_contact');
  assert.equal(state.plan, '3-Yr Comprehensive');
  assert.match(action.question, /reach you directly/);

  // contact (emoji button tap)
  ({ state, action } = flow2Session.advance(state, '✅ Yes', ctx));
  assert.equal(state.step, 'awaiting_confirm');
  assert.equal(state.includeContact, true);

  // confirm → create
  ({ state, action } = flow2Session.advance(state, '➡️ No, go ahead', ctx));
  assert.equal(state, null, 'session complete');
  assert.equal(action.type, 'create');
  assert.deepEqual(action.args, {
    customer: 'Apoorva',
    model: 'Grand Vitara',
    plan: '3-Yr Comprehensive',
    includeContact: true,
  });
});

test('contact answer "No" sets includeContact false', () => {
  let { state } = flow2Session.start({ customer: 'A', model: 'M' }, ctx);
  ({ state } = flow2Session.advance(state, '3-Yr Comprehensive', ctx));
  const { state: next } = flow2Session.advance(state, 'nope', ctx);
  assert.equal(next.includeContact, false);
});

test('unmatched plan re-asks the same step without advancing', () => {
  const { state } = flow2Session.start({ customer: 'A', model: 'M' }, ctx);
  const { state: next, action } = flow2Session.advance(state, 'zzz gibberish', ctx);
  assert.equal(next.step, 'awaiting_plan', 'stays on plan step');
  assert.equal(action.type, 'reask');
});

test('unmatched contact answer re-asks, does not assume', () => {
  let { state } = flow2Session.start({ customer: 'A', model: 'M' }, ctx);
  ({ state } = flow2Session.advance(state, 'Zero Dep + RSA', ctx));
  const { state: next, action } = flow2Session.advance(state, 'hmm not sure', ctx);
  assert.equal(next.step, 'awaiting_contact');
  assert.equal(action.type, 'reask');
});

test('isCreateOfferIntent detects the trigger, including with typos', () => {
  assert.equal(
    flow2Session.isCreateOfferIntent('Apoorva visited my store yesterday and took a vitara test drive. she asked for insurance offers. help me crate a personalsied banner for her'),
    true
  );
  assert.equal(flow2Session.isCreateOfferIntent('make a personalised offer for Priya'), true);
  assert.equal(flow2Session.isCreateOfferIntent('design a banner'), true);
});

test('isCreateOfferIntent does NOT fire on Flow-1 edits or post-create replies', () => {
  assert.equal(flow2Session.isCreateOfferIntent('change the discount to 40%'), false);
  assert.equal(flow2Session.isCreateOfferIntent('what can I edit'), false);
  assert.equal(flow2Session.isCreateOfferIntent('make it in Hindi'), false);
  assert.equal(flow2Session.isCreateOfferIntent('3-Yr Comprehensive'), false);
  assert.equal(flow2Session.isCreateOfferIntent('✅ Yes'), false);
});

const MODELS = ['Grand Vitara', 'Brezza', 'Swift'];
const DEFAULTS = { customer: 'Apoorva', model: 'Grand Vitara' };

test('extractOffer pulls customer + model from the trigger text', () => {
  const out = flow2Session.extractOffer(
    'Priya took a Brezza test drive, make her a personalised banner',
    { defaults: DEFAULTS, models: MODELS }
  );
  assert.equal(out.customer, 'Priya');
  assert.equal(out.model, 'Brezza');
});

test('extractOffer resolves a distinctive model word ("vitara" → "Grand Vitara")', () => {
  const out = flow2Session.extractOffer('Apoorva test drove the vitara', { defaults: DEFAULTS, models: MODELS });
  assert.equal(out.customer, 'Apoorva');
  assert.equal(out.model, 'Grand Vitara');
});

test('extractOffer falls back to defaults when nothing is found', () => {
  const out = flow2Session.extractOffer('make me a personalised banner', { defaults: DEFAULTS, models: MODELS });
  assert.equal(out.customer, 'Apoorva');
  assert.equal(out.model, 'Grand Vitara');
});

test('confirm proceeds to create on either recognised answer', () => {
  // "Yes, I have something to add" still creates (canned banner; edits are post-create)
  let { state } = flow2Session.start({ customer: 'A', model: 'M' }, ctx);
  ({ state } = flow2Session.advance(state, 'Engine Protect combo', ctx));
  ({ state } = flow2Session.advance(state, 'No', ctx));
  const { state: done, action } = flow2Session.advance(state, '✅ Yes', ctx);
  assert.equal(done, null);
  assert.equal(action.type, 'create');
  assert.equal(action.args.plan, 'Engine Protect combo');
});
