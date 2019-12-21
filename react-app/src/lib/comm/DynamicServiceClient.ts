import { ServiceWizardClient, GetServiceStatusResult, ServiceStatus } from './coreServices/ServiceWizard';
import { ServiceClient, ServiceClientParams } from './ServiceClient';
import Cache from './Cache';

// now import the service wizard, and one auth generic client

// type Promise<T> = Promise<T>

interface ModuleInfo {

    module_name: string;
}

var moduleCache = new Cache<ServiceStatus>({
    itemLifetime: 1800000,
    monitoringFrequency: 60000,
    waiterTimeout: 30000,
    waiterFrequency: 100
});

/*
 * arg is:
 * url - service wizard url
 * timeout - request timeout
 * version - service release version or tag
 * auth - auth structure
 *   token - auth token
 *   username - username
 * rpcContext
 */

export interface DynamicServiceClientParams extends ServiceClientParams {
    version?: string;
    // module: string;
}

const DEFAULT_TIMEOUT = 10000;

export abstract class DynamicServiceClient extends ServiceClient {
    version: string | null;

    abstract module: string;

    serviceDiscoveryURL: string;
    serviceDiscoveryModule: string = 'ServiceWizard';

    constructor(params: DynamicServiceClientParams) {
        super(params);
        const { version } = params;


        this.version = version || null;
        if (this.version === 'auto') {
            this.version = null;
        }

        this.serviceDiscoveryURL = params.url;
        // this.module = module;
    }

    private moduleId() {
        let moduleId;
        if (!this.version) {
            moduleId = this.module + ':auto';
        } else {
            moduleId = this.module + ':' + this.version;
        }
        return moduleId;
    }

    private getCached(fetcher: () => Promise<GetServiceStatusResult>) {
        return moduleCache.getItemWithWait({
            id: this.moduleId(),
            fetcher: fetcher
        });
    }

    // setCached(value: any) {
    //     moduleCache.setItem(this.moduleId(), value);
    // }

    // TODO: Promise<any> -> Promise<ServiceStatusResult>
    private async lookupModule(): Promise<GetServiceStatusResult> {
        const moduleInfo = await this.getCached(
            (): Promise<GetServiceStatusResult> => {
                const client = new ServiceWizardClient({
                    url: this.serviceDiscoveryURL!,
                    authorization: this.authorization,
                    timeout: this.timeout
                });
                // NB wrapped in promise.resolve because the promise we have 
                // here is bluebird, which supports cancellation, which we need.
                return Promise.resolve(
                    client.getServiceStatus({
                        module_name: this.module,
                        version: this.version
                    })
                );
            }
        );
        this.module = moduleInfo.module_name;
        this.url = moduleInfo.url;
        return moduleInfo;
    }

    // private async syncModule()

    // async callFunc<P, T>(funcName: string, params: P): Promise<T> {
    //     const moduleInfo = await this.lookupModule();
    //     const client = new ServiceClient({
    //         module: moduleInfo.module_name,
    //         url: moduleInfo.url,
    //         token: this.token
    //     });

    //     return await client.callFunc<P, T>(funcName, params);
    // }

    async callFunc<ParamType, ReturnType>(funcName: string, params: ParamType): Promise<ReturnType> {
        await this.lookupModule();
        return super.callFunc(funcName, params);
    }
    async callFuncEmptyResult<ParamType, ReturnType>(funcName: string, params: ParamType): Promise<void> {
        await this.lookupModule();
        return super.callFuncEmptyResult(funcName, params);
    }
}

