import hre from 'hardhat'
import { getDeployerAddress, getOwnerAddress } from '../../tasks/_utils'

export async function getTestUserAddress(index: number = 0) {
    const signers = await hre.ethers.getSigners()
    const signer = signers.at(-1 - index)
    if (!signer) {
        throw new Error(`Index ${index} is invalid, user is not found!`)
    }
    const owner = await getOwnerAddress(hre)
    const deployer = await getDeployerAddress(hre)
    if (signer.address === owner || signer.address === deployer) {
        throw new Error(`User with index ${index} is reserved!`)
    }
    return signer.address
}