import hre from 'hardhat'
import * as helpers from '@nomicfoundation/hardhat-network-helpers'

import { getTestUserAddress } from './helpers/get-test-user-address'
import { getMarketTokenAsCERC20 } from './helpers/get-market-token'
import { deployFixture } from './helpers/deploy-fixture'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { getComptrollerContract } from '../tasks/_utils'
import { silentConsole } from './helpers/silent-console'
import { getMarkets } from '../config/markets'
import { supplyToMarket } from './helpers/supply-to-market'
import { getUserLiquidity } from './helpers/get-user-liquidity'
import { enterMarkets } from './helpers/enter-markets'
import warp from './helpers/warp'
import { BigNumber } from 'ethers'

describe.only('Market interaction', () => {
    let userA: SignerWithAddress
    let userB: SignerWithAddress

    beforeEach(async () => {
        await helpers.loadFixture(deployFixture)

        const addressOfUserA = await getTestUserAddress(0)
        userA = await hre.ethers.getSigner(addressOfUserA)

        const addressOfUserB = await getTestUserAddress(1)
        userB = await hre.ethers.getSigner(addressOfUserB)
    })

    it('Should supply underlying asset and mint cToken', async () => {
        const { tokenContract, marketContract, balanceBeforeSupply, supplyAmountWithDecimals } = await supplyToMarket(userA, 'USDT', 2500)

        const balanceAfterSupply = await tokenContract.balanceOf(userA.address)

        // Should take exact mint amount from the user's balance
        const userBalanceDifference = balanceBeforeSupply.sub(balanceAfterSupply)
        expect(userBalanceDifference.toString()).to.be.eq(supplyAmountWithDecimals.toString())

        const marketBalance = await tokenContract.balanceOf(marketContract.address)
        expect(marketBalance.toString()).to.be.eq(supplyAmountWithDecimals.toString())

        // Some amount of supply goes to zero address
        // https://github.com/akshaysrivastav/first-deposit-bug-compv2?tab=readme-ov-file#the-fix
        const marketTokenSupply = await marketContract.totalSupply()
        const marketTokenBalanceOfUser = await marketContract.balanceOf(userA.address)
        const marketTokenBalanceDifference = marketTokenSupply.sub(marketTokenBalanceOfUser).toString()
        expect(marketTokenBalanceDifference).to.be.eq('1000')
    })

    it('Should redeem and get underlying asset back using redeemUnderlying', async () => {
        const supplyAmount = 2500
        const { tokenContract, marketContract, underlyingDecimals } = await supplyToMarket(userA, 'USDT', supplyAmount)

        // The available amount to redeem might be slightly lower than the actual supplied amount due to "first deposit bug fix":
        // https://github.com/akshaysrivastav/first-deposit-bug-compv2?tab=readme-ov-file#the-fix
        const availableToRedeemBN = await marketContract.callStatic.balanceOfUnderlying(userA.address)
        const availableToRedeem = +hre.ethers.utils.formatUnits(availableToRedeemBN, underlyingDecimals)
        const difference = supplyAmount - availableToRedeem
        expect(difference < 0.0001).to.be.eq(true)

        // Should redeem all available amount
        const userBalanceBeforeRedeem = await tokenContract.balanceOf(userA.address)
        await marketContract.connect(userA).redeemUnderlying(availableToRedeemBN)
        const userBalanceAfterRedeem = await tokenContract.balanceOf(userA.address)
        const userBalanceDifference = userBalanceAfterRedeem.sub(userBalanceBeforeRedeem)
        expect(userBalanceDifference.toString()).to.be.eq(availableToRedeemBN.toString())

        const marketTokenSupply = await marketContract.totalSupply()
        expect(marketTokenSupply.toString()).to.be.eq('1000')

        const marketTokenBalanceOfUser = await marketContract.balanceOf(userA.address)
        expect(marketTokenBalanceOfUser.toString()).to.be.eq('0')
    })

    it('Should redeem and get underlying asset back using normal redeem', async () => {
        const supplyAmount = 2500
        const { tokenContract, marketContract } = await supplyToMarket(userA, 'USDT', supplyAmount)

        const availableToRedeemBN = await marketContract.callStatic.balanceOfUnderlying(userA.address)
        const redeemAmount = await marketContract.balanceOf(userA.address)

        // Should redeem all available amount
        const userBalanceBeforeRedeem = await tokenContract.balanceOf(userA.address)
        await marketContract.connect(userA).redeem(redeemAmount)
        const userBalanceAfterRedeem = await tokenContract.balanceOf(userA.address)
        const userBalanceDifference = userBalanceAfterRedeem.sub(userBalanceBeforeRedeem)
        expect(userBalanceDifference.toString()).to.be.eq(availableToRedeemBN.toString())

        const marketTokenSupply = await marketContract.totalSupply()
        expect(marketTokenSupply.toString()).to.be.eq('1000')

        const marketTokenBalanceOfUser = await marketContract.balanceOf(userA.address)
        expect(marketTokenBalanceOfUser.toString()).to.be.eq('0')
    })

    it('Should set collateral factor', async () => {
        const marketContract = await getMarketTokenAsCERC20('USDT')
        const comptrollerContract = await getComptrollerContract(hre)

        // Collateral factor should be 0 by default because total supply is 0
        {
            const marketData = await comptrollerContract.markets(marketContract.address)
            expect(marketData.collateralFactorMantissa.toString()).to.be.eq('0')
        }

        // Try to set collateral factor explicitly
        await silentConsole(async () => await hre.run('markets/sync-params'))

        // Collateral factor should be 0 because total supply is still 0
        {
            const marketData = await comptrollerContract.markets(marketContract.address)
            expect(marketData.collateralFactorMantissa.toString()).to.be.eq('0')
        }

        // Mint some amount of cToken
        await supplyToMarket(userA, 'USDT', 100)

        // Try to set collateral factor explicitly again
        await silentConsole(async () => await hre.run('markets/sync-params'))

        // Collateral factor should be set to the value from the config
        {
            const configs = await getMarkets(hre)
            const collateralFactorMantissa = hre.ethers.utils.parseUnits(configs['USDT'].collateralFactor, 18).toString()
            const marketData = await comptrollerContract.markets(marketContract.address)
            expect(marketData.collateralFactorMantissa.toString()).to.be.eq(collateralFactorMantissa)
        }
    })

    it('Should borrow from the same market', async () => {
        // Make initial supply on behalf of another user first, to get the round numbers for calculations, 
        // because the frst mint will have 1000 wei amount less, due to to "first deposit bug fix":
        // https://github.com/akshaysrivastav/first-deposit-bug-compv2?tab=readme-ov-file#the-fix
        await supplyToMarket(userB, 'USDT', 100)

        const { marketContract, tokenContract, underlyingDecimals } = await supplyToMarket(userA, 'USDT', 100)

        // Setup collateral factor to be able to borrow
        await silentConsole(async () => await hre.run('markets/sync-params'))

        // We need to enter the market first before borrowing from another one (to tell the contract to use this market as collateral)
        await enterMarkets(userA, 'USDT')

        // Check if initial liquidity is valid
        {
            const liquidityOfUserA = await getUserLiquidity(userA)
            const expectedLiqudity = hre.ethers.utils.parseUnits('80', underlyingDecimals) // since coll. factor is .8
            expect(liquidityOfUserA.liquidity).to.be.eq(expectedLiqudity)
            expect(liquidityOfUserA.shortfall).to.be.eq('0')
        }

        const userTokenBalanceBeforeBorrow = await tokenContract.balanceOf(userA.address)

        const borrowAmount = hre.ethers.utils.parseUnits('50', underlyingDecimals)
        await marketContract.connect(userA).borrow(borrowAmount)

        const userTokenBalanceAfterBorrow = await tokenContract.balanceOf(userA.address)
        expect(userTokenBalanceAfterBorrow.sub(userTokenBalanceBeforeBorrow).toString()).to.be.eq(borrowAmount.toString())

        // Check if liquidity decreased after borrow
        {
            const liquidityOfUserA = await getUserLiquidity(userA)
            const expectedLiquidity = hre.ethers.utils.parseUnits('30', underlyingDecimals) // since coll. factor is .8
            expect(liquidityOfUserA.liquidity).to.be.eq(expectedLiquidity)
            expect(liquidityOfUserA.shortfall).to.be.eq('0')
        }
    })

    it('Should borrow and repay to the same market', async () => {
        // Make initial supply on behalf of another user first, to get the round numbers for calculations, 
        // because the frst mint will have 1000 wei amount less, due to to "first deposit bug fix":
        // https://github.com/akshaysrivastav/first-deposit-bug-compv2?tab=readme-ov-file#the-fix
        await supplyToMarket(userB, 'USDT', 100)

        const { marketContract, tokenContract, underlyingDecimals } = await supplyToMarket(userA, 'USDT', 100) 

        // Setup collateral factor to be able to borrow
        await silentConsole(async () => await hre.run('markets/sync-params'))
        
        // We need to enter the market first before borrowing from another one (to tell the contract to use this market as collateral)
        await enterMarkets(userA, 'USDT')

        // Check if initial liquidity is valid
        {
            const liquidityOfUserA = await getUserLiquidity(userA)
            const expectedLiqudity = hre.ethers.utils.parseUnits('80', underlyingDecimals) // since coll. factor is .8
            expect(liquidityOfUserA.liquidity).to.be.eq(expectedLiqudity)
            expect(liquidityOfUserA.shortfall).to.be.eq('0')
        }

        const borrowAmount = hre.ethers.utils.parseUnits('50', underlyingDecimals)
        await marketContract.connect(userA).borrow(borrowAmount)

        await tokenContract.connect(userA).approve(marketContract.address, borrowAmount)
        await marketContract.connect(userA).repayBorrow(borrowAmount)

        // Check if liquidity after repay back to the initial state (almost, i.e. excluding borrow fee)
        {
            const liquidityOfUserA = await getUserLiquidity(userA)
            const liquidity = +hre.ethers.utils.formatUnits(liquidityOfUserA.liquidity, underlyingDecimals)
            expect(80 - liquidity < 0.0001).to.be.eq(true)
            expect(liquidityOfUserA.shortfall).to.be.eq('0')
        }
    })

    it('Should borrow from the different market', async () => {
        // Make initial supply on behalf of another user first, to get the round numbers for calculations, 
        // because the frst mint will have 1000 wei amount less, due to to "first deposit bug fix":
        // https://github.com/akshaysrivastav/first-deposit-bug-compv2?tab=readme-ov-file#the-fix
        await supplyToMarket(userB, 'USDT', 100)
        const { marketContract: marketContractWBNB, tokenContract: contractWBNB, underlyingDecimals: decimalsWBNB } = await supplyToMarket(userB, 'WBNB', 1)

        // Setup collateral factor to be able to borrow
        await silentConsole(async () => await hre.run('markets/sync-params'))

        await supplyToMarket(userA, 'USDT', 1000)

        // We need to enter the market first before borrowing from another one (to tell the contract to use this market as collateral)
        await enterMarkets(userA, 'USDT')

        const borrowAmount = hre.ethers.utils.parseUnits('1', decimalsWBNB)
        await marketContractWBNB.connect(userA).borrow(borrowAmount)

        {
            const liquidityOfUserA = await getUserLiquidity(userA)
            const expectedLiqudity = hre.ethers.utils.parseUnits('300', 18) // since coll. factor is .8 and WBNB price is 500
            expect(liquidityOfUserA.liquidity).to.be.eq(expectedLiqudity)
            expect(liquidityOfUserA.shortfall).to.be.eq('0')
        }

        await contractWBNB.connect(userA).approve(marketContractWBNB.address, borrowAmount)
        await marketContractWBNB.connect(userA).repayBorrow(borrowAmount)

        {
            const liquidityOfUserA = await getUserLiquidity(userA)
            const liquidity = +hre.ethers.utils.formatUnits(liquidityOfUserA.liquidity, 18)
            expect(80 - liquidity < 0.0001).to.be.eq(true)
            expect(liquidityOfUserA.shortfall).to.be.eq('0')
        }
    })

    it.only('Should liquidate shortfall position', async () => {
        // Set up userA to supply collateral
        const { marketContract: usdtMarketContract, tokenContract: usdtTokenContract, underlyingDecimals: usdtDecimals } = 
            await supplyToMarket(userA, 'USDT', 1000);

        // Supply WBNB for liquidation
        const { marketContract: wbnbMarketContract, tokenContract: wbnbTokenContract, underlyingDecimals: wbnbDecimals } = 
            await supplyToMarket(userB, 'WBNB', 5);
        
        // Setup collateral factor
        await silentConsole(async () => await hre.run('markets/sync-params'));
        
        // Make userA enter the USDT market as collateral
        await enterMarkets(userA, 'USDT');

        // UserA borrows WBNB against their USDT collateral (99% of the available amount)
        const borrowAmount = hre.ethers.utils.parseUnits(2 * 0.8 * 0.99999 + '', wbnbDecimals) // Since BNB price is 500 USDT and collateral factor is 0.8
        await wbnbMarketContract.connect(userA).borrow(borrowAmount)
        
        // Check that userA has a valid position before time manipulation
        const initialLiquidity = await getUserLiquidity(userA);
        expect(initialLiquidity.shortfall).to.be.eq('0');
        
        // Move time forward to accrue interest and push position into shortfall
        await warp(60 * 60 * 24 * 15); // 15 days
        
        // Accrue interest on both markets
        await usdtMarketContract.accrueInterest();
        await wbnbMarketContract.accrueInterest();
        
        // Check that userA is now in shortfall
        const afterInterestLiquidity = await getUserLiquidity(userA);
        expect(afterInterestLiquidity.shortfall).to.not.be.eq('0')
        
        // Get balances before liquidation
        const userBWbnbBalanceBefore = await wbnbTokenContract.balanceOf(userB.address);
        const userBUsdtCTokenBalanceBefore = await usdtMarketContract.balanceOf(userB.address);
        const protocolUsdtCTokenBalanceBefore = await usdtMarketContract.totalReserves();
        
        // Calculate the repay amount (usually up to 50% of the borrowed amount in Compound V2)
        const userABorrowBalance = await wbnbMarketContract.borrowBalanceStored(userA.address);
        const repayAmount = userABorrowBalance.div(2); // Liquidate 50% of the debt
        
        // Approve tokens for repayment
        await wbnbTokenContract.connect(userB).approve(wbnbMarketContract.address, repayAmount);
        
        // UserB liquidates UserA's position
        /**
         * 
         * FAILS WITH
         * Error: VM Exception while processing transaction: reverted with custom error 'LiquidateComptrollerRejection(17)'
         * 
         */
        await wbnbMarketContract.connect(userB).liquidateBorrow(
            userA.address,       // Borrower address
            repayAmount,         // Amount to repay
            usdtMarketContract.address  // cToken collateral to seize
        );
        
        // // Get balances after liquidation
        // const userBWbnbBalanceAfter = await wbnbTokenContract.balanceOf(userB.address);
        // const userBUsdtCTokenBalanceAfter = await usdtMarketContract.balanceOf(userB.address);
        // const protocolUsdtCTokenBalanceAfter = await usdtMarketContract.totalReserves();
        
        // // Verify that userB spent WBNB to repay the debt
        // const wbnbSpent = userBWbnbBalanceBefore.sub(userBWbnbBalanceAfter);
        // expect(wbnbSpent).to.be.eq(repayAmount);
        
        // // Verify that userB received cUSDT tokens as reward
        // const usdtCTokenReceived = userBUsdtCTokenBalanceAfter.sub(userBUsdtCTokenBalanceBefore);
        // expect(usdtCTokenReceived).to.be.gt('0');
        
        // // Verify that protocol reserves increased
        // const reservesIncrease = protocolUsdtCTokenBalanceAfter.sub(protocolUsdtCTokenBalanceBefore);
        // expect(reservesIncrease).to.be.gt('0');
        
        // // Verify that borrower's shortfall decreased
        // const finalLiquidity = await getUserLiquidity(userA);
        // expect(finalLiquidity.shortfall).to.be.lt(afterInterestLiquidity.shortfall);
    })
    
    it('Should accumulate reserves', async () => {})
})