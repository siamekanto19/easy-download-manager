export namespace domain {
	
	export class Download {
	    id: string;
	    url: string;
	    originalUrl: string;
	    fileName: string;
	    outputDirectory: string;
	    targetPath: string;
	    tempPath: string;
	    status: string;
	    progressPercent: number;
	    downloadedBytes: number;
	    totalBytes: number;
	    speedBytesPerSec: number;
	    etaSeconds: number;
	    sourceHost: string;
	    mimeType: string;
	    canResume: boolean;
	    resumable: boolean;
	    errorMessage: string;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    startedAt?: any;
	    // Go type: time
	    completedAt?: any;
	    // Go type: time
	    lastUpdatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new Download(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.url = source["url"];
	        this.originalUrl = source["originalUrl"];
	        this.fileName = source["fileName"];
	        this.outputDirectory = source["outputDirectory"];
	        this.targetPath = source["targetPath"];
	        this.tempPath = source["tempPath"];
	        this.status = source["status"];
	        this.progressPercent = source["progressPercent"];
	        this.downloadedBytes = source["downloadedBytes"];
	        this.totalBytes = source["totalBytes"];
	        this.speedBytesPerSec = source["speedBytesPerSec"];
	        this.etaSeconds = source["etaSeconds"];
	        this.sourceHost = source["sourceHost"];
	        this.mimeType = source["mimeType"];
	        this.canResume = source["canResume"];
	        this.resumable = source["resumable"];
	        this.errorMessage = source["errorMessage"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.startedAt = this.convertValues(source["startedAt"], null);
	        this.completedAt = this.convertValues(source["completedAt"], null);
	        this.lastUpdatedAt = this.convertValues(source["lastUpdatedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class HistoryEntry {
	    id: string;
	    downloadId: string;
	    url: string;
	    fileName: string;
	    targetPath: string;
	    finalStatus: string;
	    totalBytes: number;
	    // Go type: time
	    startedAt?: any;
	    // Go type: time
	    endedAt?: any;
	    attemptNumber: number;
	    actionSummary: string;
	    errorMessage: string;
	    // Go type: time
	    createdAt: any;
	
	    static createFrom(source: any = {}) {
	        return new HistoryEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.downloadId = source["downloadId"];
	        this.url = source["url"];
	        this.fileName = source["fileName"];
	        this.targetPath = source["targetPath"];
	        this.finalStatus = source["finalStatus"];
	        this.totalBytes = source["totalBytes"];
	        this.startedAt = this.convertValues(source["startedAt"], null);
	        this.endedAt = this.convertValues(source["endedAt"], null);
	        this.attemptNumber = source["attemptNumber"];
	        this.actionSummary = source["actionSummary"];
	        this.errorMessage = source["errorMessage"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

