// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {ICollectModule} from '../../../interfaces/ICollectModule.sol';
import {ModuleBase} from '../ModuleBase.sol';
import {FollowValidationModuleBase} from '../FollowValidationModuleBase.sol';
import {IERC1155} from '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Errors} from '../../../libraries/Errors.sol';

/**
 * @notice A struct containing the necessary data to execute collect actions on a publication
 *
 * @param gatedTokens[] the tokens required to collect this module
 * @param nftContract the nft/multi-token contract address
 */

struct ProfilePublicationData {
    uint[] gatedTokens;
    address nftContract;
    bool isERC20;
    bool isERC721;
    bool isOR;
    uint[] balance;
}

contract GatedCollect is FollowValidationModuleBase, ICollectModule {
    constructor(address hub) ModuleBase(hub) {}

    mapping(uint256 => mapping(uint256 => ProfilePublicationData))
        internal _dataByPublicationByProfile;

    function initializePublicationCollectModule(
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) external override onlyHub returns (bytes memory) {
        (uint256[] memory gatedTokens, address nftContract,bool isERC20,bool isERC721,bool isOR,uint[] memory balance) = abi.decode(
            data,
            (uint256[], address,bool,bool,bool,uint[])
        );
        if(isERC20 && isERC721){
            revert Errors.InitParamsInvalid();
        }
        if(isERC20 || isERC721){
            if(gatedTokens.length>0){
                revert Errors.InitParamsInvalid();
            }
            if(balance.length>1){
                revert Errors.InitParamsInvalid();
            }
        }
        if(!isERC20 && !isERC721){
            if(gatedTokens.length!=balance.length){
                revert Errors.InitParamsInvalid();
            }
        }
        _dataByPublicationByProfile[profileId][pubId].gatedTokens = gatedTokens;
        _dataByPublicationByProfile[profileId][pubId].nftContract = nftContract;
        _dataByPublicationByProfile[profileId][pubId].isERC20=isERC20;
        _dataByPublicationByProfile[profileId][pubId].isERC721=isERC721;
        _dataByPublicationByProfile[profileId][pubId].isOR=isOR;
        _dataByPublicationByProfile[profileId][pubId].balance=balance;
        return data;
    }

    function processCollect(
        uint256 referrerProfileId,
        address collector,
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) external virtual override onlyHub {
        if (_dataByPublicationByProfile[profileId][pubId].isERC721) {
            _processCollectNFT(collector, profileId, pubId, data);
        }
        else if(_dataByPublicationByProfile[profileId][pubId].isERC20){
            _processCollectERC20(collector,profileId,pubId,data);
        }
        else if(_dataByPublicationByProfile[profileId][pubId].isOR){
            uint [] memory gatedTokens=_dataByPublicationByProfile[profileId][pubId].gatedTokens;
            address nftContract=_dataByPublicationByProfile[profileId][pubId].nftContract;
            uint[] memory balance=_dataByPublicationByProfile[profileId][pubId].balance;
            _isHoldingOR(gatedTokens,nftContract,collector,balance);
        }
        else{
            uint [] memory gatedTokens=_dataByPublicationByProfile[profileId][pubId].gatedTokens;
            address nftContract=_dataByPublicationByProfile[profileId][pubId].nftContract;
            uint[] memory balance=_dataByPublicationByProfile[profileId][pubId].balance;
            _isHolding(gatedTokens,nftContract,collector,balance);
        }
    }

    function _processCollectNFT(
        address collector,
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) internal view {
        address nftContract = _dataByPublicationByProfile[profileId][pubId].nftContract;
        uint[] memory balance=_dataByPublicationByProfile[profileId][pubId].balance;
        if(IERC721(nftContract).balanceOf(collector)<balance[0]){
            revert Errors.InsufficentBalance();
        }
    }

    function _isHolding(
        uint256[] memory gatedTokens,
        address nftContract,
        address collector,
        uint[] memory balance
    ) internal view{
        require(gatedTokens.length==balance.length,"Tokens and balances must be of equal length");
        for(uint i=0;i<gatedTokens.length;i++){
            require(
                IERC1155(nftContract).balanceOf(collector,gatedTokens[i]) > balance[i],
                'You do not have the required token'
            );
        }
    }
    function _isHoldingOR(
        uint256[] memory gatedTokens,
        address nftContract,
        address collector,
        uint[] memory balance
    ) internal view{
        bool flag=false;
        require(gatedTokens.length==balance.length,"Tokens and balances must be of equal length");
        for(uint i=0;i<gatedTokens.length;i++){
            if(IERC1155(nftContract).balanceOf(collector,gatedTokens[i])>balance[i]){
                flag=true;
            }
        }
        if(!flag){
            revert Errors.InsufficentBalance();
        }
    }
    function _processCollectERC20(
        address collector,
        uint256 profileId,
        uint256 pubId,
        bytes calldata data
    ) internal view {
        address ERC20= _dataByPublicationByProfile[profileId][pubId].nftContract;
        uint[] memory balance=_dataByPublicationByProfile[profileId][pubId].balance;
        require(balance.length==1,"Invalid length of balance");
        if(balance[0]>IERC20(ERC20).balanceOf(collector)){
            revert Errors.InsufficentBalance();
        }
    }
}
