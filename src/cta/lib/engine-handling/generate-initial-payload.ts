import { basename, resolve } from 'node:path'
import {
  createSerializedOptionsFromPersisted,
  getAllAddOns,
  getFrameworkById,
  getRawRegistry,
  getRegistryAddOns,
  readConfigFile,
} from '@tanstack/cta-engine'

import { ensureFrameworkRegistered } from './framework-registry'
import { cleanUpFiles } from './file-helpers'
import { createAppWrapper } from './create-app-wrapper'
import {
  getApplicationMode,
  getForcedAddOns,
  getForcedRouterMode,
  getProjectOptions,
  getProjectPath,
  getRegistry as getRegistryURL,
} from './server-environment'

import type { AddOnInfo } from '../types'

function convertAddOnToAddOnInfo(addOn: any): AddOnInfo {
  return {
    id: addOn.id,
    name: addOn.name,
    description: addOn.description,
    modes: addOn.modes as Array<'code-router' | 'file-router'>,
    type: addOn.type,
    smallLogo: addOn.smallLogo,
    logo: addOn.logo,
    link: addOn.link!,
    dependsOn: addOn.dependsOn,
  }
}

export async function generateInitialPayload() {
  // Dynamically import only the heavy file operation stuff
  const { recursivelyGatherFiles } = await import('@tanstack/cta-engine')

  // Ensure framework is registered
  ensureFrameworkRegistered()

  const projectPath = getProjectPath()
  const applicationMode = getApplicationMode()

  const localFiles =
    applicationMode === 'add'
      ? await cleanUpFiles(await recursivelyGatherFiles(projectPath, false))
      : {}

  const forcedRouterMode = getForcedRouterMode()

  async function getSerializedOptions() {
    if (applicationMode === 'setup') {
      const projectOptions = getProjectOptions()
      return {
        ...projectOptions,
        framework: projectOptions.framework || 'react-cra',
        projectName: projectOptions.projectName || basename(projectPath),
        mode: forcedRouterMode || projectOptions.mode,
        typescript: projectOptions.typescript || true,
        tailwind: projectOptions.tailwind || true,
        git: projectOptions.git || true,
        targetDir:
          projectOptions.targetDir ||
          resolve(projectPath, projectOptions.projectName),
      } as SerializedOptions
    } else {
      const persistedOptions = await readConfigFile(projectPath)
      if (!persistedOptions) {
        throw new Error('No config file found')
      }
      return createSerializedOptionsFromPersisted(persistedOptions)
    }
  }

  const serializedOptions = await getSerializedOptions()

  const rawRegistry = await getRawRegistry(getRegistryURL())
  const registryAddOns = await getRegistryAddOns(getRegistryURL())

  const output = await createAppWrapper(serializedOptions, {
    dryRun: true,
  })

  const framework = await getFrameworkById(serializedOptions.framework)

  const addOns = Object.keys(framework!.supportedModes).reduce((acc, mode) => {
    acc[mode] = getAllAddOns(framework!, mode).map(convertAddOnToAddOnInfo)
    return acc
  }, {} as Record<string, Array<AddOnInfo>>)

  for (const addOnInfo of registryAddOns) {
    const addOnFramework = rawRegistry?.['add-ons']?.find(
      (addOn) => addOn.url === addOnInfo.id
    )
    if (addOnFramework?.framework === serializedOptions.framework) {
      for (const mode of addOnInfo.modes) {
        addOns[mode].push(convertAddOnToAddOnInfo(addOnInfo))
      }
    }
  }

  const serializedRegistry = {
    ['add-ons']: [],
    starters: (rawRegistry?.starters || []).filter(
      (starter) => starter.framework === serializedOptions.framework
    ),
  }

  return {
    supportedModes: framework!.supportedModes,
    applicationMode,
    localFiles,
    addOns,
    options: serializedOptions,
    output,
    forcedRouterMode,
    forcedAddOns: getForcedAddOns(),
    registry: serializedRegistry,
  }
}
