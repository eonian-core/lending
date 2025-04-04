import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getAddressesOfMarkets, getComptrollerContract, getDeployerAddress, measureNativeTokenSpentByDeployer } from "../_utils";
import { CErc20, CToken, ERC20, ERC20PresetMinterPauser, SimplePriceOracle } from "index";
import { getMarkets } from "../../config/markets";
import { ethers } from "ethers";

const EXPECTED_NETWORK = 'zen_testnet'

const TOKEN_PRICES = {
    ptUSD: ethers.utils.parseUnits('1', 18),
    ptETH: ethers.utils.parseUnits('2000', 18),
    zUSDC: ethers.utils.parseUnits('1', 18)
}

/**
 * #1. Deploy test tokens and price oracle
 */
task("prepare-zen-testnet", "Deploy test tokens and price oracle")
    .setAction(async (args, hre) => {
        if (hre.network.name !== EXPECTED_NETWORK) {
            throw new Error(`Expected network name: ${EXPECTED_NETWORK}, got: ${hre.network.name}`)
        }
        await measureNativeTokenSpentByDeployer(hre, async () => {
            const ptUSD = await deployTestERC20(hre, 'Private Test USD', 'ptUSD')
            const ptETH = await deployTestERC20(hre, 'Private Test ETH', 'ptETH')

            const priceData = [
                { token: ptUSD.address, price: TOKEN_PRICES.ptUSD },
                { token: ptETH.address, price: TOKEN_PRICES.ptETH },
                { token: await getMarkets(hre).then(markets => markets['zUSDC'].underlyingTokenAddress), price: TOKEN_PRICES.zUSDC }
            ]

            const simplePriceOracle = await deploySimplePriceOracle(hre)
            await simplePriceOracle.setPrices(
                priceData.map(e => e.token),
                priceData.map(e => e.price)
            )
        })
    });

/**
 * #2. Deploy compound v2 fork
 */
task("deploy-zen-testnet", "Deploy zen testnet main contracts")
    .setAction(async (args, hre) => {
        if (hre.network.name !== EXPECTED_NETWORK) {
            throw new Error(`Expected network name: ${EXPECTED_NETWORK}, got: ${hre.network.name}`)
        }
        await measureNativeTokenSpentByDeployer(hre, async () => {
            await hre.run('initial-setup', {
                oracleName: 'SimplePriceOracle',
                oracleContract: 'SimplePriceOracle',
            })
        })
    })

/**
 * #3. Check if markets work using test accounts
 */
task("check-zen-testnet", "Check if markets work using test accounts")
    .setAction(async (args, hre) => measureNativeTokenSpentByDeployer(hre, async () => {
        if (hre.network.name !== EXPECTED_NETWORK) {
            throw new Error(`Expected network name: ${EXPECTED_NETWORK}, got: ${hre.network.name}`)
        }

        const [deployer, ...testAccounts] = await hre.ethers.getSigners()
        console.log(`Test accounts: ${testAccounts.map(e => e.address).join(', ')}`)
        
        const marketConfigs = await getMarkets(hre)
        console.log(`Markets: ${Object.keys(marketConfigs).join(', ')}`)

        /**
         * Give some native ZTC to test accounts
         */
        console.log('\n> Minting native ZTC to test accounts...')
        for (const account of testAccounts) {
            const balanceBefore = await hre.ethers.provider.getBalance(account.address)
            if (balanceBefore.eq(0)) {
                const tx = await deployer.sendTransaction({
                    to: account.address,
                    value: hre.ethers.utils.parseUnits('3', 18)
                });
                await tx.wait();
            }
            const balanceAfter = await hre.ethers.provider.getBalance(account.address)
            console.log(`Balance of ${account.address}: ${hre.ethers.utils.formatEther(balanceAfter)}`)
        }

        /**
         * Mint some ptUSD and ptETH to test accounts
         */
        console.log('\n> Minting ptUSD and ptETH to test accounts...')
        for (const account of testAccounts) {
            const mintAmounts = Object.entries({
                'ptUSD': hre.ethers.utils.parseUnits('1000', 18),
                'ptETH': hre.ethers.utils.parseUnits('1', 18),
            })
            for (const [token, amount] of mintAmounts) {
                const testERC20 = await hre.ethers.getContractAt<ERC20PresetMinterPauser>('ERC20PresetMinterPauser', marketConfigs[token].underlyingTokenAddress)
                const balanceBefore = await testERC20.balanceOf(account.address)
                if (balanceBefore.lt(amount)) {
                    const mintAmount = amount.sub(balanceBefore)
                    const tx = await testERC20.connect(deployer).mint(account.address, mintAmount)
                    await tx.wait()
                    console.log(`Minted ${hre.ethers.utils.formatEther(mintAmount)} ${token} to ${account.address}`)
                }
                const balanceAfter = await testERC20.balanceOf(account.address)
                console.log(`Balance of ${account.address} for ${token}: ${hre.ethers.utils.formatEther(balanceAfter)}`)
            }
        }

        /**
         * Check if price oracle is working
         */
        console.log('\n> Checking if price oracle is working...')
        const marketAddresses = await getAddressesOfMarkets(hre)
        const comptroller = await getComptrollerContract(hre)
        const oracleAddress = await comptroller.oracle()
        const oracleContract = await hre.ethers.getContractAt<SimplePriceOracle>('SimplePriceOracle', oracleAddress)
        for (const token of Object.keys(marketConfigs)) {
            const prices = await oracleContract.getPrice(marketAddresses[token])
            if (prices.eq(TOKEN_PRICES[token])) {
                console.log(`Price of ${token}: ${hre.ethers.utils.formatEther(TOKEN_PRICES[token])}`)
            } else {
                throw new Error(`Price of ${token} is not correct! Expected: ${hre.ethers.utils.formatEther(TOKEN_PRICES[token])}, got: ${hre.ethers.utils.formatEther(prices)}`)
            }
        }

        const [testAccountA, testAccountB] = testAccounts

        /**
         * Check if testAccountA can supply ptUSD and ptETH to the markets
         */
        console.log('\n> Checking if testAccountA can supply ptUSD and ptETH to the markets...')
            
        const ptUSDContract = await hre.ethers.getContractAt<ERC20PresetMinterPauser>('ERC20PresetMinterPauser', marketConfigs['ptUSD'].underlyingTokenAddress)
        const ptETHContract = await hre.ethers.getContractAt<ERC20PresetMinterPauser>('ERC20PresetMinterPauser', marketConfigs['ptETH'].underlyingTokenAddress)
        const ptUSDMarketContract = await hre.ethers.getContractAt<CErc20>('CErc20', marketAddresses['ptUSD'])
        const ptETHMarketContract = await hre.ethers.getContractAt<CErc20>('CErc20', marketAddresses['ptETH'])

        if ((await ptUSDMarketContract.balanceOf(testAccountA.address)).eq(0)) {
            const ptUSDToMint = hre.ethers.utils.parseUnits('500', 18)
            let tx = await ptUSDContract.connect(testAccountA).approve(ptUSDMarketContract.address, ptUSDToMint, { gasLimit: 1000000 })
            await tx.wait()
            tx = await ptUSDMarketContract.connect(testAccountA).mint(ptUSDToMint, { gasLimit: 1000000 })
            await tx.wait()

        }
        
        if ((await ptETHMarketContract.balanceOf(testAccountA.address)).eq(0)) {
            const ptETHToMint = hre.ethers.utils.parseUnits('0.2', 18)
            let tx = await ptETHContract.connect(testAccountA).approve(ptETHMarketContract.address, ptETHToMint, { gasLimit: 1000000 })
            await tx.wait()
            tx = await ptETHMarketContract.connect(testAccountA).mint(ptETHToMint, { gasLimit: 1000000 })
            await tx.wait()
        }
        
        const emtptUSDBalanceOfTestAccountA = await ptUSDMarketContract.balanceOf(testAccountA.address)
        const emtptETHBalanceOfTestAccountA = await ptETHMarketContract.balanceOf(testAccountA.address)
        const ptUSDSuppliedByTestAccountA = await ptUSDMarketContract.callStatic.balanceOfUnderlying(testAccountA.address)
        const ptETHSuppliedByTestAccountA = await ptETHMarketContract.callStatic.balanceOfUnderlying(testAccountA.address)
        console.log(`Deposited balance of testAccountA for emtptUSD: ${hre.ethers.utils.formatUnits(emtptUSDBalanceOfTestAccountA, 8)}, underlying: ${hre.ethers.utils.formatUnits(ptUSDSuppliedByTestAccountA, 18)}`)
        console.log(`Deposited balance of testAccountA for emtptETH: ${hre.ethers.utils.formatUnits(emtptETHBalanceOfTestAccountA, 8)}, underlying: ${hre.ethers.utils.formatUnits(ptETHSuppliedByTestAccountA, 18)}`)

        /**
         * Check if testAccountB can supply ptUSD
         */
        console.log('\n> Checking if testAccountB can supply ptUSD...')
        if ((await ptUSDMarketContract.balanceOf(testAccountB.address)).eq(0)) {
            const ptUSDToMintB = hre.ethers.utils.parseUnits('750', 18)
            let tx = await ptUSDContract.connect(testAccountB).approve(ptUSDMarketContract.address, ptUSDToMintB, { gasLimit: 1000000 })
            await tx.wait()
            tx = await ptUSDMarketContract.connect(testAccountB).mint(ptUSDToMintB, { gasLimit: 1000000 })
            await tx.wait()
        }
        const emtptUSDBalanceOfTestAccountB = await ptUSDMarketContract.balanceOf(testAccountB.address)
        const ptUSDSuppliedByTestAccountB = await ptUSDMarketContract.callStatic.balanceOfUnderlying(testAccountB.address)
        console.log(`Deposited balance of testAccountB for emtptUSD: ${hre.ethers.utils.formatUnits(emtptUSDBalanceOfTestAccountB, 8)}, underlying: ${hre.ethers.utils.formatUnits(ptUSDSuppliedByTestAccountB, 18)}`)
        console.log(`Total supply of ptUSD in the market: ${hre.ethers.utils.formatUnits(await ptUSDMarketContract.getCash(), 18)}`)

        /**
         * Check if testAccountA can borrow ptUSD more than it has supplied
         */
        console.log('\n> Checking if testAccountA can borrow ptUSD more than it has supplied...')
        const ptUSDBorrowed = await ptUSDMarketContract.callStatic.borrowBalanceCurrent(testAccountA.address)
        if (ptUSDBorrowed.eq(0)) {
            const ptUSDToBorrow = ptUSDSuppliedByTestAccountA.add(hre.ethers.utils.parseUnits('1', 18))
            let tx = await comptroller.connect(testAccountA).enterMarkets([ptUSDMarketContract.address, ptETHMarketContract.address], { gasLimit: 1000000 })
            await tx.wait()
            tx = await ptUSDMarketContract.connect(testAccountA).borrow(ptUSDToBorrow, { gasLimit: 1000000 })
            await tx.wait()
            console.log(`Borrowed ${hre.ethers.utils.formatEther(ptUSDBorrowed)} ptUSD`)
        } else {
            console.log(`TestAccountA already borrowed ptUSD, amount: ${hre.ethers.utils.formatEther(ptUSDBorrowed)}`)
        }
    }))

async function deployTestERC20(hre: HardhatRuntimeEnvironment, name: string, symbol: string): Promise<ERC20> {
    const deployResult = await hre.deployments.deploy(name, {
        from: await getDeployerAddress(hre),
        contract: 'ERC20PresetMinterPauser',
        args: [name, symbol],
        log: true,
    });
    if (deployResult.newlyDeployed) {
        console.log(`Test token ${name} (${symbol}) is deployed at ${deployResult.address}`)
    } else {
        console.log(`Test token ${name} (${symbol}) is already deployed at ${deployResult.address}`)
    }
    return await hre.ethers.getContractAt<ERC20>("ERC20PresetMinterPauser", deployResult.address)
}

async function deploySimplePriceOracle(hre: HardhatRuntimeEnvironment): Promise<SimplePriceOracle> {
    const deployResult = await hre.deployments.deploy('SimplePriceOracle', {
        from: await getDeployerAddress(hre),
        contract: 'SimplePriceOracle',
        log: true,
    })
    if (deployResult.newlyDeployed) {
        console.log(`SimplePriceOracle is deployed at ${deployResult.address}`)
    } else {
        console.log(`SimplePriceOracle is already deployed at ${deployResult.address}`)
    }
    return await hre.ethers.getContractAt<SimplePriceOracle>("SimplePriceOracle", deployResult.address)
}
