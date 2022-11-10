import { BigNumber } from '@ethersproject/contracts/node_modules/@ethersproject/bignumber';
import { parseEther } from '@ethersproject/units';
import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ERC20__factory } from '../../../typechain-types';
import { MAX_UINT256, ZERO_ADDRESS } from '../../helpers/constants';
import { ERRORS } from '../../helpers/errors';
import { getTimestamp, matchEvent, waitForTx } from '../../helpers/utils';
import {
  abiCoder,
  BPS_MAX,
  currency,
  feeCollectModule,
  FIRST_PROFILE_ID,
  governance,
  lensHub,
  lensHubImpl,
  makeSuiteCleanRoom,
  MOCK_FOLLOW_NFT_URI,
  MOCK_PROFILE_HANDLE,
  MOCK_PROFILE_URI,
  MOCK_URI,
  moduleGlobals,
  REFERRAL_FEE_BPS,
  treasuryAddress,
  TREASURY_FEE_BPS,
  user,
  userAddress,
  userTwo,
  userTwoAddress,
  gatedCollectModule,
  token,
  userThree,
  nftToken,
  deployer
} from '../../__setup.spec';

makeSuiteCleanRoom('Gated Collect Module', function () {
  beforeEach(async () => {
    await expect(
      lensHub.createProfile({
        to: userAddress,
        handle: MOCK_PROFILE_HANDLE,
        imageURI: MOCK_PROFILE_URI,
        followModule: ZERO_ADDRESS,
        followModuleInitData: [],
        followNFTURI: MOCK_FOLLOW_NFT_URI,
      })
    ).to.not.be.reverted;
    await expect(
      lensHub.connect(governance).whitelistCollectModule(gatedCollectModule.address, true)
    ).to.not.be.reverted;
  });


  context('Negatives',function(){


    context('Publication Creation',function(){
        it('Should fail to post with unwhitelisted collect module',async()=>{
            const collectModuleInitData=abiCoder.encode(
                ['uint[]','address','bool','bool','bool','uint[]'],
                [[1],userTwoAddress,false,false,false,[1]]
            )
            await expect(
                lensHub.post({
                  profileId: FIRST_PROFILE_ID,
                  contentURI: MOCK_URI,
                  collectModule: feeCollectModule.address,
                  collectModuleInitData: collectModuleInitData,
                  referenceModule: ZERO_ADDRESS,
                  referenceModuleInitData: [],
                })).to.be.revertedWith(ERRORS.COLLECT_MODULE_NOT_WHITELISTED);
        });
        it('Should fail to post if booleans are ambiguous',async()=>{
          const collectModuleInitData=abiCoder.encode(
            ['uint[]','address','bool','bool','bool','uint[]'],
            [[1],token.address,true,true,false,[1]]
        )
        await expect(
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: gatedCollectModule.address,
            collectModuleInitData: collectModuleInitData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
        })
        it('Should fail to post if length of required token != length of balances in ERC1155',async()=>{
          const collectModuleInitData=abiCoder.encode(
            ['uint[]','address','bool','bool','bool','uint[]'],
            [[],token.address,false,false,false,[1]]
        )
        await expect(
          lensHub.post({
            profileId: FIRST_PROFILE_ID,
            contentURI: MOCK_URI,
            collectModule: gatedCollectModule.address,
            collectModuleInitData: collectModuleInitData,
            referenceModule: ZERO_ADDRESS,
            referenceModuleInitData: [],
          })).to.be.revertedWith(ERRORS.INIT_PARAMS_INVALID);
        })
    });


    context('CollectingERC1155',function(){
        beforeEach(async ()=>{
            const collectModuleInitData=abiCoder.encode(
              ['uint[]','address','bool','bool','bool','uint[]'],
              [[1,2],token.address,false,false,false,[1,10]]
            );
            await expect(
                lensHub.post({
                    profileId: FIRST_PROFILE_ID,
                    contentURI: MOCK_URI,
                    collectModule: gatedCollectModule.address,
                    collectModuleInitData: collectModuleInitData,
                    referenceModule: ZERO_ADDRESS,
                    referenceModuleInitData: [],
                  })).to.not.be.reverted;
        })
        it('Should fail to collect if the user does not have enough balance',async()=>{
            await expect(token.connect(userTwo).mint(5,"example.uri")).to.not.be.reverted;
            await expect(
                lensHub.connect(userTwo).collect(FIRST_PROFILE_ID,1,[])
            ).to.be.revertedWith("You do not have the required token");
        });
    });


    context('CollectingERC20',function(){
      beforeEach(async()=>{
        const collectModuleInitData=abiCoder.encode(
          ['uint[]','address','bool','bool','bool','uint[]'],
          [[],currency.address,true,false,false,[1]]
        );
        await expect(
            lensHub.post({
                profileId: FIRST_PROFILE_ID,
                contentURI: MOCK_URI,
                collectModule: gatedCollectModule.address,
                collectModuleInitData: collectModuleInitData,
                referenceModule: ZERO_ADDRESS,
                referenceModuleInitData: [],
              })).to.not.be.reverted;
      });
      it('Should fail as collector has insufficient bal',async()=>{
        await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID,1,[])).to.be.reverted;
      })
      it('Should pass as the user has the balance',async()=>{
        await expect(currency.connect(userTwo).mint(userTwoAddress,2)).to.not.be.reverted;
        await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID,1,[])).to.not.be.reverted;
      })
    })
    
  });





  context ('Positives',function (){


    context('Collecting ERC1155wOR',function(){
      beforeEach(async()=>{
        const collectModuleInitData=abiCoder.encode(
          ['uint[]','address','bool','bool','bool','uint[]'],
          [[1,2],token.address,false,false,true,[1,10]]
        );
        await expect(
          lensHub.post({
              profileId: FIRST_PROFILE_ID,
              contentURI: MOCK_URI,
              collectModule: gatedCollectModule.address,
              collectModuleInitData: collectModuleInitData,
              referenceModule: ZERO_ADDRESS,
              referenceModuleInitData: [],
            })).to.not.be.reverted;
      })
      it("Should let user collect if he has any one of the tokens",async()=>{
        await expect(token.connect(userTwo).mint(5,"example.uri")).to.not.be.reverted;
        await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID,1,[])).to.not.be.reverted;
      });
      it('Should not let the user collect as he doesnt have any of the tokens',async()=>{
        await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID,1,[])).to.be.reverted;
      })
    })


    context('Simple ERC1155 collect',async()=>{
      beforeEach(async ()=>{
        const collectModuleInitData=abiCoder.encode(
          ['uint[]','address','bool','bool','bool','uint[]'],
          [[1,2],token.address,false,false,false,[1,2]]
        );
        await expect(
            lensHub.post({
                profileId: FIRST_PROFILE_ID,
                contentURI: MOCK_URI,
                collectModule: gatedCollectModule.address,
                collectModuleInitData: collectModuleInitData,
                referenceModule: ZERO_ADDRESS,
                referenceModuleInitData: [],
              })).to.not.be.reverted;
        await expect(token.connect(userTwo).mint(5,"example.uri")).to.not.be.reverted;
        await expect(token.connect(userTwo).mint(5,"example.uri2")).to.not.be.reverted;
    });
    it('Should let the user collect',async ()=>{
        await expect( lensHub.connect(userTwo).collect(FIRST_PROFILE_ID,1,[])).to.not.be.reverted;
        //await expect(lensHub.connect(userThree).collect(FIRST_PROFILE_ID,1,[])).to.be.revertedWith("You do not have the required toke");
    });
    })

    context('ERC721 collects',function(){
      beforeEach(async()=>{
        const collectModuleInitData=abiCoder.encode(
          ['uint[]','address','bool','bool','bool','uint[]'],
          [[],nftToken.address,false,true,false,[1]]
        );
        await expect(
            lensHub.post({
                profileId: FIRST_PROFILE_ID,
                contentURI: MOCK_URI,
                collectModule: gatedCollectModule.address,
                collectModuleInitData: collectModuleInitData,
                referenceModule: ZERO_ADDRESS,
                referenceModuleInitData: [],
              })).to.not.be.reverted;
      });
      it('Should not let the user collect if he has insufficient bal',async () => {
        await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID,1,[])).to.be.reverted;
      });
      it('Should let the user collect',async()=>{
        await expect (nftToken.connect(deployer).safeMint(userTwoAddress,1)).to.not.be.reverted;
        await expect(lensHub.connect(userTwo).collect(FIRST_PROFILE_ID,1,[])).to.not.be.reverted;
      })

      
    });
    })

    
  })
// });
