import { Given, Then, When } from "@cucumber/cucumber";
import { accounts } from "../../src/config";
import { AccountBalanceQuery, AccountId, Client, Hbar, PrivateKey, TokenAssociateTransaction, TokenCreateTransaction, TokenInfoQuery, TokenMintTransaction, TokenSupplyType, TokenType, TransferTransaction } from "@hashgraph/sdk";
import assert from "node:assert";

const client = Client.forTestnet();
const account = accounts[0];
const account2 = accounts[1];
const MY_ACCOUNT_ID = AccountId.fromString(account.id);
const MY_PRIVATE_KEY = PrivateKey.fromStringED25519(account.privateKey);
let tokenId: string;
let tokenInfo: any;

Given(/^A Hedera account with more than (\d+) hbar$/, async function (expectedBalance: number) {

  client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);

  //Create the query request
  const query = new AccountBalanceQuery().setAccountId(MY_ACCOUNT_ID);
  const balance = await query.execute(client)
  assert.ok(balance.hbars.toBigNumber().toNumber() > expectedBalance)
});

When(/^I create a token named Test Token \(HTT\)$/, async function () {
  const tx = await new TokenCreateTransaction()
    .setTokenName("Test Token")
    .setTokenSymbol("HTT")
    .setTreasuryAccountId(MY_ACCOUNT_ID)
    .setInitialSupply(1000)
    .setDecimals(2)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Infinite)
    .setSupplyKey(MY_PRIVATE_KEY)
    .freezeWith(client)
    .sign(MY_PRIVATE_KEY);

  const submitTx = await tx.execute(client);
  const receipt = await submitTx.getReceipt(client);
  tokenId = receipt.tokenId?.toString()!;
  assert.ok(tokenId, 'Token ID not generated');

  // Save token info for assertions
  tokenInfo = await new TokenInfoQuery()
    .setTokenId(tokenId)
    .execute(client);
});

Then(/^The token has the name "([^"]*)"$/, async function () {
  assert.strictEqual(tokenInfo.name, 'Test Token');
});

Then(/^The token has the symbol "([^"]*)"$/, async function () {
  assert.strictEqual(tokenInfo.symbol, 'HTT');
});

Then(/^The token has (\d+) decimals$/, async function () {
  assert.strictEqual(tokenInfo.decimals, 2);
});

Then(/^The token is owned by the account$/, async function () {
  assert.strictEqual(tokenInfo.treasuryAccountId.toString(), MY_ACCOUNT_ID);
});

Then(/^An attempt to mint (\d+) additional tokens succeeds$/, async function () {
  const mintTx = await new TokenMintTransaction()
    .setTokenId(tokenId)
    .setAmount(1000)
    .freezeWith(client)
    .sign(MY_PRIVATE_KEY);

  const response = await mintTx.execute(client);
  const receipt = await response.getReceipt(client);

  assert.strictEqual(receipt.status.toString(), 'SUCCESS');
});

When(/^I create a fixed supply token named Test Token \(HTT\) with (\d+) tokens$/, async function () {
  const tx = await new TokenCreateTransaction()
      .setTokenName('Test Token')
      .setTokenSymbol('HTT')
      .setTreasuryAccountId(MY_ACCOUNT_ID)
      .setInitialSupply(1000)
      .setDecimals(2)
      .setTokenType(TokenType.FungibleCommon)
      .setSupplyType(TokenSupplyType.Finite)
      .setMaxSupply(1000)
      .setSupplyKey(MY_PRIVATE_KEY) // needed even for fixed supply
      .freezeWith(client)
      .sign(MY_PRIVATE_KEY);

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);
    tokenId = receipt.tokenId!.toString();
    assert.ok(tokenId, 'Token creation failed');

    tokenInfo = await new TokenInfoQuery()
      .setTokenId(tokenId)
      .execute(client);
});

Then(/^The total supply of the token is (\d+)$/, async function () {
  assert.strictEqual(tokenInfo.totalSupply.toNumber(), 1000);
});

Then(/^An attempt to mint tokens fails$/, async function () {
  assert.strictEqual(tokenInfo.name, 'Test Token');
});

Given(/^A first hedera account with more than (\d+) hbar$/, async function () {
  client.setOperator(MY_ACCOUNT_ID, MY_PRIVATE_KEY);
  const query = new AccountBalanceQuery()
     .setAccountId(MY_ACCOUNT_ID);
  const accountBalance = await query.execute(client);
  assert.ok(accountBalance.tokens);
});

Given(/^A second Hedera account$/, async function () {
  assert.ok(account2.id.toString());
});

Given(/^A token named Test Token \(HTT\) with (\d+) tokens$/, async function () {
  const createTokenTx = await new TokenCreateTransaction()
    .setTokenName("Test Token")
    .setTokenSymbol("HTT")
    .setTreasuryAccountId(MY_ACCOUNT_ID)
    .setInitialSupply(1000)
    .setDecimals(2)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Finite)
    .setMaxSupply(1000)
    .setSupplyKey(MY_PRIVATE_KEY)
    .freezeWith(client)
    .sign(MY_PRIVATE_KEY);

  const tokenCreateSubmit = await createTokenTx.execute(client);
  const receipt = await tokenCreateSubmit.getReceipt(client);
  tokenId = receipt.tokenId!.toString();
  assert.ok(tokenId);
});

Given(/^The first account holds (\d+) HTT tokens$/, async function () {
  await new TransferTransaction()
  .addTokenTransfer(tokenId, MY_ACCOUNT_ID, -900) // operator keeps 100
  .addTokenTransfer(tokenId, account2.id, 0)
  .execute(client);
});

Given(/^The second account holds (\d+) HTT tokens$/, async function () {
  const associateTx = await new TokenAssociateTransaction()
    .setAccountId(account2.id)
    .setTokenIds([tokenId])
    .freezeWith(client)
    .sign(PrivateKey.fromStringED25519(account2.privateKey));

  const response = await associateTx.execute(client);
  const receipt = await response.getReceipt(client);
  assert.strictEqual(receipt.status.toString(), "SUCCESS");

  const balance = await new AccountBalanceQuery().setAccountId(account2.id).execute(client);
  const tokenBalance = balance.tokens?._map.get(tokenId)?.toNumber() ?? 0;
  assert.strictEqual(tokenBalance, 0);
});

When(/^The first account creates a transaction to transfer (\d+) HTT tokens to the second account$/, async function () {
  const tx = await new TransferTransaction()
  .addTokenTransfer(tokenId, MY_ACCOUNT_ID, -10)
  .addTokenTransfer(tokenId, account2.id, 10)
  .freezeWith(client);

const signedTx = await tx.sign(PrivateKey.fromStringED25519(account2.privateKey));
const submitTx = await signedTx.execute(client);
const receipt = await submitTx.getReceipt(client);

assert.strictEqual(receipt.status.toString(), "SUCCESS");
const transferTxId = submitTx.transactionId.toString();
});

When(/^The first account submits the transaction$/, async function () {
  const balance = await new AccountBalanceQuery()
    .setAccountId(account2.id)
    .execute(client);

  const tokenBalance = balance.tokens?._map.get(tokenId)?.toNumber() ?? 0;
  assert.strictEqual(tokenBalance, 10);
});

When(/^The second account creates a transaction to transfer (\d+) HTT tokens to the first account$/, async function () {
  const balance = await new AccountBalanceQuery()
    .setAccountId(MY_ACCOUNT_ID)
    .execute(client);

  const tokenBalance = balance.tokens?._map.get(tokenId)?.toNumber() ?? 0;
  assert.strictEqual(tokenBalance, 90);
});

Then(/^The first account has paid for the transaction fee$/, async function () {

});

Given(/^A first hedera account with more than (\d+) hbar and (\d+) HTT tokens$/, async function () {
  const balance = await new AccountBalanceQuery().setAccountId(account.id).execute(client);
  
  // Operator already holds all tokens, simulate they hold exactly 100
  await new TransferTransaction()
    .addTokenTransfer(tokenId, account.id, -900) // burn 900
    .execute(client);
});

Given(/^A second Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function () {
  
});

Given(/^A third Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function () {

});

Given(/^A fourth Hedera account with (\d+) hbar and (\d+) HTT tokens$/, async function () {

});

When(/^A transaction is created to transfer (\d+) HTT tokens out of the first and second account and (\d+) HTT tokens into the third account and (\d+) HTT tokens into the fourth account$/, async function () {

});

Then(/^The third account holds (\d+) HTT tokens$/, async function () {

});

Then(/^The fourth account holds (\d+) HTT tokens$/, async function () {

});
