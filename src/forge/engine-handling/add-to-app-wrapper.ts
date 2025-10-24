import { resolve } from 'node:path'
import { TMP_TARGET_DIR } from '~/forge/constants'
import type { DryRunOutput } from '~/forge/types'

export async function addToAppWrapper(
  addOns: Array<string>,
  opts: {
    dryRun?: boolean
    stream?: boolean
    environmentFactory?: () => any
  }
) {
  // Dynamically import CTA engine to prevent client bundling
  const {
    CONFIG_FILE,
    addToApp,
    createAppOptionsFromPersisted,
    createDefaultEnvironment,
    createMemoryEnvironment,
    createSerializedOptionsFromPersisted,
    readConfigFile,
    recursivelyGatherFiles,
    writeConfigFileToEnvironment,
  } = await import('@tanstack/cta-engine')
  const { cleanUpFileArray, cleanUpFiles } = await import('./file-helpers')
  const { getProjectPath } = await import('./server-environment')
  const { createAppWrapper } = await import('./create-app-wrapper')

  const projectPath = getProjectPath()

  const persistedOptions = await readConfigFile(projectPath)

  if (!persistedOptions) {
    throw new Error('No config file found')
  }

  const options = await createAppOptionsFromPersisted(persistedOptions)
  options.targetDir = opts.dryRun ? TMP_TARGET_DIR : projectPath

  const newAddons: Array<string> = []
  for (const addOn of addOns) {
    if (!options.chosenAddOns.some((a) => a.id === addOn)) {
      newAddons.push(addOn)
    }
  }

  if (newAddons.length === 0) {
    const serializedOptions =
      createSerializedOptionsFromPersisted(persistedOptions)
    return await createAppWrapper(serializedOptions, opts)
  }

  async function createEnvironment(): Promise<{
    environment: Environment
    output: DryRunOutput
  }> {
    if (opts.dryRun) {
      const { environment, output } = createMemoryEnvironment(projectPath)

      const localFiles = await cleanUpFiles(
        await recursivelyGatherFiles(projectPath, false)
      )
      for (const file of Object.keys(localFiles)) {
        environment.writeFile(resolve(projectPath, file), localFiles[file])
      }
      return { environment, output }
    }
    return {
      environment: opts.environmentFactory?.() ?? createDefaultEnvironment(),
      output: { files: {}, deletedFiles: [], commands: [] },
    }
  }

  const { environment, output } = await createEnvironment()

  if (opts.stream) {
    return new ReadableStream({
      async start(controller) {
        environment.startStep = ({
          id,
          type,
          message,
        }: {
          id: string
          type: string
          message: string
        }) => {
          controller.enqueue(
            JSON.stringify({
              msgType: 'start',
              id,
              type,
              message,
            }) + '\n'
          )
        }
        environment.finishStep = (id: string, message: string) => {
          controller.enqueue(
            JSON.stringify({
              msgType: 'finish',
              id,
              message,
            }) + '\n'
          )
        }

        environment.startRun()
        await addToApp(environment, newAddons, projectPath, {
          forced: true,
        })
        environment.finishRun()
        controller.close()
      },
    })
  } else {
    environment.startRun()
    environment.writeFile(
      resolve(projectPath, CONFIG_FILE),
      JSON.stringify(persistedOptions, null, 2)
    )
    await addToApp(environment, newAddons, projectPath, {
      forced: true,
    })
    writeConfigFileToEnvironment(environment, options)
    environment.finishRun()

    output.files = cleanUpFiles(output.files, projectPath)
    output.deletedFiles = cleanUpFileArray(output.deletedFiles, projectPath)
    return output
  }
}
