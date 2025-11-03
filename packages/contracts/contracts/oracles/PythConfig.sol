// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library PythConfig {
    // Pyth Contract Addresses
    address constant PYTH_AMOY = 0xA2aa501b19aff244D90cc15a4Cf739D2725B5729;
    address constant PYTH_SEPOLIA = 0xDd24F84d36BF92C65F92307595335bdFab5Bbd21;
    
    // Price Feed IDs (bytes32)
    bytes32 constant POL_USD = 0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472;
    bytes32 constant BTC_USD = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    bytes32 constant ETH_USD = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    bytes32 constant AVAX_USD = 0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7;
    bytes32 constant DOGE_USD = 0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c;
    bytes32 constant ATOM_USD = 0xb00b60f88b03a6a625a8d1c048c3f66653edf217439983d037e7222c4e612819;
    bytes32 constant BNB_USD = 0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f;
    bytes32 constant USDC_USD = 0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a;
}
