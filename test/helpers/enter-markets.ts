import hre from 'hardhat'
import { getAddressesOfMarkets, getComptrollerContract } from "../../tasks/_utils"
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

export async function enterMarkets(user: SignerWithAddress, ...underlyingTokenSymbols: string[]) {
    const comptrollerContract = await getComptrollerContract(hre)
    const addressesOfMarkets = await getAddressesOfMarkets(hre)
    const addresses = underlyingTokenSymbols.map(symbol => addressesOfMarkets[symbol])
    await comptrollerContract.connect(user).enterMarkets(addresses)
}