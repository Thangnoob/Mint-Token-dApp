import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { writeFileSync, readFileSync } from "fs";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("====================");
  console.log("Network:", hre.network.name);
  console.log("Deploying contracts with account:", deployer);
  console.log("====================");

  // Deploy MyMintableToken
  console.log("====================");
  console.log("Deploy MyMintableToken Contract");
  console.log("====================");
  const tokenDeployment = await deploy("MyMintableToken", {
    contract: "MyMintableToken",
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
    skipIfAlreadyDeployed: false,
  });

  // Read Merkle root from merkle.json
  const merkleData = JSON.parse(readFileSync("merkle.json", "utf8"));
  const merkleRoot = merkleData.root;

  // Deploy MerkleDistributor
  console.log("====================");
  console.log("Deploy MerkleDistributor Contract");
  console.log("====================");
  const distributorDeployment = await deploy("MerkleDistributor", {
    contract: "MerkleDistributor",
    from: deployer,
    args: [tokenDeployment.address, merkleRoot],
    log: true,
    autoMine: true,
    skipIfAlreadyDeployed: false,
  });

  // Mint tokens to MerkleDistributor
  const totalAmount = merkleData.proofs.reduce(
    (sum: bigint, proof: { amount: string }) => sum + BigInt(proof.amount),
    BigInt(0)
  );
  const tokenContract = await ethers.getContractAt("MyMintableToken", tokenDeployment.address);
  await tokenContract.mint(distributorDeployment.address, totalAmount);
  console.log(`Minted ${totalAmount} tokens to MerkleDistributor at ${distributorDeployment.address}`);

  // Save deployment info
  const deploymentInfo = {
    tokenAddress: tokenDeployment.address,
    distributorAddress: distributorDeployment.address,
    merkleRoot,
  };
  writeFileSync("deployment.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("Deployment info saved to deployment.json");
};

func.tags = ["deploy"];
export default func;
