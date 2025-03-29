import hre from 'hardhat'
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { getMarketTokenAsCERC20 } from "./get-market-token"
import { mintERC20 } from "./mint-erc20"

export async function supplyToMarket(user: SignerWithAddress, underlyingSymbol: string, supplyAmount: number) {
    const { tokenContract, balance: balanceBeforeSupply } = await mintERC20(underlyingSymbol, user.address, supplyAmount)

    const marketContract = await getMarketTokenAsCERC20(underlyingSymbol)
    const underlyingDecimals = await tokenContract.decimals()

    const supplyAmountWithDecimals = hre.ethers.utils.parseUnits(supplyAmount.toString(), underlyingDecimals)
    await tokenContract.connect(user).approve(marketContract.address, supplyAmountWithDecimals)
    await marketContract.connect(user).mint(supplyAmountWithDecimals)

    return {
        tokenContract,
        marketContract,
        balanceBeforeSupply,
        supplyAmount,
        supplyAmountWithDecimals,
        underlyingDecimals
    }
}