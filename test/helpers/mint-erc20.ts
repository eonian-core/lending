import { BigNumberish } from 'ethers';
import hre, { network } from 'hardhat'
import { TestERC20 } from 'contracts';
import { getUnderlyingTokenAddress } from './get-market-token';

export async function mintERC20(tokenAddressOrSymbol: string, receiverAddress: string, amount: BigNumberish) {
    const tokenContract = await getTestERC20Contract(tokenAddressOrSymbol)

    const balanceBefore = await tokenContract.balanceOf(receiverAddress)

    // Try minting different ERC20 implementations until success
    for (const fn of [mintOwnableERC20, mintWrappedNativeERC20]) {
        try {
            await fn(tokenContract, receiverAddress, amount)
            break
        } catch (e) { /* ignore */ }
    }
    const balanceAfter = await tokenContract.balanceOf(receiverAddress)

    const decimals = await tokenContract.decimals()
    const mintAmount = hre.ethers.utils.parseUnits(amount.toString(), decimals)
    const balanceDifference = balanceAfter.sub(balanceBefore)
    if (!balanceDifference.eq(mintAmount)) {
        throw new Error(`Mint function is not working as expected. Required: ${mintAmount.toString()}, got: ${balanceDifference.toString()}`)
    }

    return { tokenContract, balance: balanceAfter }
}

async function mintWrappedNativeERC20(tokenContract: TestERC20, receiverAddress: string, amount: BigNumberish) {
    const decimals = await tokenContract.decimals()
    const mintAmount = hre.ethers.utils.parseUnits(amount.toString(), decimals);
    await hre.network.provider.send("hardhat_setBalance", [
        receiverAddress,
        (mintAmount.mul(2)).toHexString().replace("0x0", "0x"),
    ]);
    const signer = await hre.ethers.getSigner(receiverAddress)
    await tokenContract.connect(signer).deposit({ value: mintAmount, from: receiverAddress });
}

async function mintOwnableERC20(tokenContract: TestERC20, receiverAddress: string, amount: BigNumberish) {
    const tokenOwner = await tokenContract.owner()
    const decimals = await tokenContract.decimals()

    await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [tokenOwner] });

    const impersonatedSigner = await hre.ethers.getSigner(tokenOwner);
    const connectedTokenContract = tokenContract.connect(impersonatedSigner)

    const mintAmount = hre.ethers.utils.parseUnits(amount.toString(), decimals);
    await connectedTokenContract.mint(mintAmount);
    await connectedTokenContract.transfer(receiverAddress, mintAmount)

    await hre.network.provider.request({ method: "hardhat_stopImpersonatingAccount", params: [tokenOwner] });
}

async function getTestERC20Contract(tokenAddressOrSymbol: string): Promise<TestERC20> {
    const tokenAddress = await getUnderlyingTokenAddress(tokenAddressOrSymbol)
    return await hre.ethers.getContractAt<TestERC20>('TestERC20', tokenAddress)
}