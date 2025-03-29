import hre from 'hardhat'
import { getComptrollerContract } from "../../tasks/_utils"
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

export async function getUserLiquidity(user: SignerWithAddress | string) {
    const userAddress = typeof user === 'string' ? user : user.address
    const comptrollerContract = await getComptrollerContract(hre)
    const accountLiquidity = await comptrollerContract.getAccountLiquidity(userAddress)

    const error = accountLiquidity[0].toNumber()
    if (error !== 0) {
        throw new Error(`Method "getAccountLiquidity" returned error: ${error}`)
    }

    const liquidity = accountLiquidity[1].toString()
    const shortfall = accountLiquidity[2].toString()

    return { liquidity, shortfall }
}