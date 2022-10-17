import { Provider } from '@ethersproject/providers'
import Lyra from '@lyrafinance/lyra-js'
import { ethers, providers } from 'ethers'
import { getBalance, getTokenBalance } from './actions/balance'
import faucet from './actions/faucet'
import { maketrade } from './actions/maketrade'
import { optimismInfuraProvider } from './clients/ethersClient'
import { Tokens } from './constants/token'
import { GetPrice } from './integrations/coingecko'
import { GetArbitrageDeals } from './lyra/arbitrage'
import { ArbConfig } from './types/arbConfig'
import { OptionType, ProviderType, Underlying } from './types/arbs'
import { Arb, ArbDto, LyraTradeArgs } from './types/lyra'
import printObject from './utils/printObject'
import { Wallet } from './wallets/wallet'

export async function initializeLyraBot() {
  const lyra = new Lyra({
    provider: optimismInfuraProvider,
    subgraphUri: 'https://api.thegraph.com/subgraphs/name/lyra-finance/mainnet',
    blockSubgraphUri: 'https://api.thegraph.com/subgraphs/name/lyra-finance/optimism-mainnet-blocks',
  })

  const signer = new ethers.Wallet(Wallet().privateKey, lyra.provider)
  await getBalances(lyra.provider, signer)

  // created a default config
  const config: ArbConfig = {
    markets: [Underlying.ETH],
    optionTypes: [OptionType.CALL, OptionType.PUT],
    profitThreshold: 0,
  }

  await GetPrice()
  const arbs = await GetArbitrageDeals(config, lyra, Underlying.ETH)
  //printObject(arbs)
  //const arbBtc = await GetArbitrageDeals(lyra, 'btc')
  //printObject(arbBtc)
  //const arbSol = await GetArbitrageDeals(lyra, 'sol')
  //printObject(arbSol)

  // pick an arb to perform
  const arb = filterArbs(arbs)

  if (!arb) {
    console.log('No arb available')
    return
  }

  // BUY SIDE
  //await trade(arb, Underlying.ETH, lyra, signer, true)

  // // SELL SIDE
  await trade(arb, Underlying.ETH, lyra, signer, false)
}

export const getBalances = async (provider: Provider, signer: ethers.Wallet) => {
  console.log('Balances:')

  const ethBalance = await getBalance(signer.address, provider)
  console.log(`Eth: ${ethBalance}`)

  Object.values(Tokens).map(async (value, index) => {
    const bal = await getTokenBalance(value, provider, signer)
    console.log(`${Object.keys(Tokens)[index]}: ${bal}`)
  })
}

export async function trade(arb: Arb, market: Underlying, lyra: Lyra, signer: ethers.Wallet, isBuy = true) {
  let resp = ''
  const provider = isBuy ? arb?.buy.provider : arb.sell.provider

  if (provider === ProviderType.LYRA) {
    await tradeLyra(arb, market, lyra, signer, isBuy)
    resp = 'lyra'
  } else if (provider === ProviderType.DERIBIT) {
    await tradeDeribit(arb, market, isBuy)
    resp = 'deribit'
  }
  // todo create response object, deal with different scenarios, fail, success etc..
  return resp
}

export function filterArbs(arbDto: ArbDto) {
  // todo use config to filter the arbs
  // for now just get first one
  if (arbDto.arbs.length > 0) {
    return arbDto.arbs[0]
  }
}

export async function tradeLyra(arb: Arb, market: Underlying, lyra: Lyra, signer: ethers.Wallet, isBuy = true) {
  // sell on Lyra

  console.log(arb)

  const amount = 0.001
  const colat = 0.001

  const tradeArgs: LyraTradeArgs = {
    amount: amount, // how to determine size?
    market: market,
    call: arb.type == OptionType.CALL,
    buy: isBuy,
    strike: isBuy ? arb.buy.id : arb.sell.id,
    collat: colat,
    base: true,
    stable: 'sUSD',
  }

  await maketrade(lyra, signer, tradeArgs)
}

export async function tradeDeribit(arb: Arb, market: Underlying, isBuy = true) {
  //todo implement trade
}
