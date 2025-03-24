import { expect } from 'chai'
import hre from 'hardhat'
import { InterestRateModel } from '../types'
import { Comptroller, Unitroller } from 'contracts'
import { getAddressesOfMarkets } from '../tasks/_utils'
import { getMarkets } from '../config/markets'
import * as helpers from '@nomicfoundation/hardhat-network-helpers'
import { silentConsole } from './helpers/silent-console'

describe('Deploy', () => {
    async function deploy() {
        await silentConsole(async () => {
            await hre.run('initial-setup', { oracleName: 'Oracle' })
        })
    }

    async function setup() {
        await deploy()
    } 

    beforeEach(async () => {
        await helpers.loadFixture(setup)
    })

    it('Should deploy and attach markets via initial setup', async () => {
        const deployments = await hre.deployments.all()

        expect(deployments['Unitroller']).to.not.be.undefined
        expect(deployments['RewardDistributor']).to.not.be.undefined
        expect(deployments['BasicLens']).to.not.be.undefined

        Object.values(InterestRateModel).forEach(name => {
            expect(deployments[name]).to.not.be.undefined
        })

        expect(deployments['Comptroller']).to.not.be.undefined
        expect(deployments['Oracle']).to.not.be.undefined

        // Check if comptroller implementation is set
        const unitrollerContract = await hre.ethers.getContractAt<Unitroller>('Unitroller', deployments['Unitroller'].address)
        const currentComptroller = await unitrollerContract.comptrollerImplementation()
        expect(currentComptroller).to.be.eq(deployments['Comptroller'].address)

        // Check if price oracle is set
        const comptrollerContract = await hre.ethers.getContractAt<Comptroller>('Comptroller', deployments['Unitroller'].address)
        const currentPriceOracle = await comptrollerContract.oracle()
        expect(currentPriceOracle).to.be.eq(deployments['Oracle'].address)

        // Check if all markets are deployed
        const mapOfDeployedAddresses = await getAddressesOfMarkets(hre)
        const deployedAddresses = Object.values(mapOfDeployedAddresses)
        const marketConfigs = await getMarkets(hre)
        expect(deployedAddresses.length).to.be.eq(Object.values(marketConfigs).length)

        // Check if all markets are attached to the comptroller
        const attachedAddresses = await comptrollerContract.getAllMarkets()
        expect(attachedAddresses.length).to.be.eq(deployedAddresses.length)
        expect(attachedAddresses).to.deep.equal(deployedAddresses)

    })

    it('Should not deploy again of contracts were not changed', async () => {
        const getImplementationAddresses = async (): Promise<string[]> => {
            const deployments = await hre.deployments.all()
            return Object.values(deployments).map(deployment => deployment.implementation ?? deployment.address)
        }

        const addressesAfterFirstDeploy = await getImplementationAddresses()

        await deploy()
        
        const addressesAfterSecondDeploy = await getImplementationAddresses()

        expect(addressesAfterFirstDeploy.length).to.be.eq(addressesAfterSecondDeploy.length)
        expect(addressesAfterFirstDeploy).to.deep.equal(addressesAfterSecondDeploy) 
    })
})
