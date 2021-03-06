import test from 'ava';
import { BigNumber, ethers } from 'ethers';
import sinon from 'sinon';

import { convert } from './converter';
import { Feed } from './priceFeeds';

const testFeedsA: readonly Feed[] = [
  {
    id: 0,
    from: 'A',
    to: 'B',
    address: '0xAB',
    decimals: 8,
  },
  {
    id: 1,
    from: 'B',
    to: 'C',
    address: '0xBC',
    decimals: 8,
  },
  {
    id: 2,
    from: 'C',
    to: 'D',
    address: '0xCD',
    decimals: 8,
  },
  {
    id: 3,
    from: 'D',
    to: 'E',
    address: '0xDE',
    decimals: 18,
  },
  {
    id: 4,
    from: 'E',
    to: 'F',
    address: '0xEF',
    decimals: 18,
  },
];

/**
 * Set answers to the following:
 *   A/B: 100
 *   B/C: 0.2
 *   C/D: 0.001
 *   D/E: 999_999_999_999_999_999
 *   E/F: 0.000_000_000_000_000_001
 */
test.before(() => {
  const contractConstructorStub = sinon.stub();
  contractConstructorStub
    .withArgs('0xAB', sinon.match.any, sinon.match.any)
    .returns({
      latestRoundData: () => ({
        answer: BigNumber.from(10_000_000_000),
      }),
    });

  contractConstructorStub
    .withArgs('0xBC', sinon.match.any, sinon.match.any)
    .returns({
      latestRoundData: () => ({
        answer: BigNumber.from(20_000_000),
      }),
    });

  contractConstructorStub
    .withArgs('0xCD', sinon.match.any, sinon.match.any)
    .returns({
      latestRoundData: () => ({
        answer: BigNumber.from(100_000),
      }),
    });

  contractConstructorStub
    .withArgs('0xDE', sinon.match.any, sinon.match.any)
    .returns({
      latestRoundData: () => ({
        answer: BigNumber.from('999999999999999999000000000000000000'),
      }),
    });

  contractConstructorStub
    .withArgs('0xEF', sinon.match.any, sinon.match.any)
    .returns({
      latestRoundData: () => ({
        answer: BigNumber.from(1),
      }),
    });

  sinon.replace(ethers, 'Contract', contractConstructorStub);
});

test.after.always(() => {
  sinon.restore();
});

test('0Anything to 0Unknown', async (t) => {
  const provider = sinon.fake();

  const result = await convert({
    amount: 0,
    from: 'Anything',
    to: 'Unknown',
    provider,
    feeds: testFeedsA,
  });

  t.deepEqual(result, '0');
});

test('5A to 5A', async (t) => {
  const provider = sinon.fake();

  const result = await convert({
    amount: 5,
    from: 'A',
    to: 'A',
    provider,
    feeds: testFeedsA,
  });

  t.deepEqual(result, '5');
});

test('5A to 500B', async (t) => {
  const provider = sinon.fake();

  const result = await convert({
    amount: 5,
    from: 'A',
    to: 'B',
    provider,
    feeds: testFeedsA,
  });

  t.deepEqual(result, '500');
});

test('5A to 100C', async (t) => {
  const provider = sinon.fake();

  const result = await convert({
    amount: 5,
    from: 'A',
    to: 'C',
    provider,
    feeds: testFeedsA,
  });

  t.deepEqual(result, '100');
});

test('5A to .1D', async (t) => {
  const provider = sinon.fake();

  const result = await convert({
    amount: 5,
    from: 'A',
    to: 'D',
    provider,
    feeds: testFeedsA,
  });

  t.deepEqual(result, '0.1');
});

test('5D to 250A', async (t) => {
  const provider = sinon.fake();

  const result = await convert({
    amount: 5,
    from: 'D',
    to: 'A',
    provider,
    feeds: testFeedsA,
  });

  t.deepEqual(result, '250');
});

test('.001C to .000001D', async (t) => {
  const provider = sinon.fake();

  const result = await convert({
    amount: 0.001,
    from: 'C',
    to: 'D',
    provider,
    feeds: testFeedsA,
  });

  t.deepEqual(result, '0.000001');
});

test('1000000A to 100000000B', async (t) => {
  const provider = sinon.fake();

  const result = await convert({
    amount: 1_000_000,
    from: 'A',
    to: 'B',
    provider,
    feeds: testFeedsA,
  });

  t.deepEqual(result, '100000000');
});

test('1D to .999999999999999999F', async (t) => {
  const provider = sinon.fake();

  const result = await convert({
    amount: 1,
    from: 'D',
    to: 'F',
    provider,
    feeds: testFeedsA,
  });

  t.deepEqual(result, '0.999999999999999999');
});

test('No endpoint + no provider', async (t) => {
  const promise = convert({
    amount: 1,
    from: 'A',
    to: 'B',
    feeds: testFeedsA,
  });

  const error = await t.throwsAsync(promise);

  t.is(error.message, `Either 'provider' or 'endpoint' must be defined`);
});

test('No provider, only endpoint', async (t) => {
  const providerFake = sinon.fake();
  sinon.replace(ethers.providers, 'JsonRpcProvider', providerFake);

  const result = await convert({
    amount: 1,
    from: 'A',
    to: 'A',
    feeds: testFeedsA,
    endpoint: 'http://localhost:test',
  });

  t.deepEqual(result, '1');
});
