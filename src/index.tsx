import { Button, Frog, TextInput, parseEther } from "frog";
import { devtools } from "frog/dev";
import { serveStatic } from "frog/serve-static";
import { wethABI } from "./abi/wethABI";
import { fixedProductMarketMakerABI } from "./abi/FixedProductMarketMakerABI";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const FPMM_ADDR = "0x5856Fb2BAB01b7b8330903eCb61374A9b2fb648c";
const COLLATERAL_TOKEN_ADDR = "0x9e1cfdAdAf5631A40d9AD3f21233a177DF05b674";

export function getViemClient() {
  const client = createPublicClient({
    transport: http(),
    chain: baseSepolia,
  });

  return client;
}

export const app = new Frog();

const client = getViemClient();

// Stores the investmentAmount for each account
const accountToInvestmentAmount: Record<string, bigint> = {};

app.frame("/", (c) => {
  return c.res({
    action: "/buy",
    image: "/lex.png",
    intents: [
      <TextInput placeholder="How much you wanna bet? (WETH)" />,
      <Button.Transaction target="/approve-tx">
        Approve spend
      </Button.Transaction>,
    ],
  });
});

app.transaction("/approve-tx", (c) => {
  const { inputText, address } = c;
  if (!inputText) {
    throw new Error("Invalid input: inputText must be a non-empty string");
  }
  const amountinWei = parseEther(inputText);
  accountToInvestmentAmount[address] = amountinWei;
  return c.contract({
    abi: wethABI,
    functionName: "approve",
    args: [FPMM_ADDR, amountinWei],
    chainId: "eip155:84532",
    to: COLLATERAL_TOKEN_ADDR,
  });
});

app.frame("/buy", (c) => {
  return c.res({
    image: "/lex.png",
    intents: [
      <Button.Transaction target="/buy-yes-tx">Yes</Button.Transaction>,
      <Button.Transaction target="/buy-no-tx">No</Button.Transaction>,
    ],
  });
});

app.transaction("/buy-yes-tx", async (c) => {
  const { address } = c;
  const investmentAmount = accountToInvestmentAmount[address];
  const minOutcomeTokensToBuy = await client.readContract({
    address: FPMM_ADDR as `0x${string}`,
    abi: fixedProductMarketMakerABI,
    functionName: "calcBuyAmount",
    args: [investmentAmount, 0],
  });
  return c.contract({
    abi: fixedProductMarketMakerABI,
    functionName: "buy",
    args: [investmentAmount, 0, minOutcomeTokensToBuy],
    chainId: "eip155:84532",
    to: FPMM_ADDR,
  });
});

app.transaction("/buy-no-tx", async (c) => {
  const { address } = c;
  const investmentAmount = accountToInvestmentAmount[address];
  const minOutcomeTokensToBuy = await client.readContract({
    address: FPMM_ADDR as `0x${string}`,
    abi: fixedProductMarketMakerABI,
    functionName: "calcBuyAmount",
    args: [investmentAmount, 1],
  });
  return c.contract({
    abi: fixedProductMarketMakerABI,
    functionName: "buy",
    args: [investmentAmount, 1, minOutcomeTokensToBuy],
    chainId: "eip155:84532",
    to: FPMM_ADDR,
  });
});

devtools(app, { serveStatic });
