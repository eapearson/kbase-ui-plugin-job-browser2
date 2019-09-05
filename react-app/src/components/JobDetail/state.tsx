import React from 'react';
import { Job, JobID, JobStatus } from '../../redux/store';
import JobDetailComponent from './view';
import { Spin, Alert } from 'antd';
import { NarrativeJobServiceClient } from '@kbase/ui-lib';
import MetricsServiceClient from '../../lib/MetricsServiceClient';
import { serviceJobToUIJob } from '../../redux/actions/utils';

const POLLING_INTERVAL = 5000;

// A simple state wrapper for job logs.

export interface JobLogLine {
    lineNumber: number;
    line: string;
    isError: boolean;
}
export type JobLog = Array<JobLogLine>;

export enum JobLogState {
    NONE,
    JOB_QUEUED,
    INITIAL_LOADING,
    ACTIVE_LOADED,
    ACTIVE_LOADING,
    FINISHED_LOADED,
    ERROR
}

// TODO: rename this and other things to JobDetailView...
export interface JobLogViewNone {
    status: JobLogState.NONE
}

export interface JobLogViewQueued {
    status: JobLogState.JOB_QUEUED
    job: Job
}

export interface JobLogViewInitialLoading {
    status: JobLogState.INITIAL_LOADING
}

export interface JobLogViewActiveLoaded {
    status: JobLogState.ACTIVE_LOADED,
    log: Array<JobLogLine>;
    job: Job
}

export interface JobLogViewActiveLoading {
    status: JobLogState.ACTIVE_LOADING,
    log: Array<JobLogLine>;
    job: Job
}

export interface JobLogViewFinishedLoaded {
    status: JobLogState.FINISHED_LOADED,
    log: Array<JobLogLine>;
    job: Job
}

export interface JobLogViewError {
    status: JobLogState.ERROR,
    error: string
}

export type JobLogView = JobLogViewNone | JobLogViewQueued | JobLogViewInitialLoading | JobLogViewActiveLoaded | JobLogViewActiveLoading | JobLogViewFinishedLoaded | JobLogViewError

export interface JobLogsStateProps {
    jobID: JobID;
    token: string;
    njsURL: string;
    serviceWizardURL: string;
}

type JobLogsStateState = JobLogView;

export default class JobLogsState extends React.Component<JobLogsStateProps, JobLogsStateState> {
    constructor(props: JobLogsStateProps) {
        super(props);

        this.state = {
            status: JobLogState.NONE
        };
    }

    async getJob(): Promise<Job> {
        const metricsClient = new MetricsServiceClient({
            token: this.props.token,
            url: this.props.serviceWizardURL
        });

        const job_id = this.props.jobID;

        const job = await metricsClient.getJob({ job_id });
        return serviceJobToUIJob(job.job_state, 'UNKNOWN');
    }

    async getJobLog(skipLines: number): Promise<Array<JobLogLine>> {
        const njsClient = new NarrativeJobServiceClient({
            token: this.props.token,
            url: this.props.njsURL,
            module: 'NarrativeJobService'
        });

        const [jobLog] = await njsClient.getJobLogs({ job_id: this.props.jobID, skip_lines: skipLines });

        return jobLog.lines.map((line, index) => {
            return {
                lineNumber: skipLines + index + 1,
                line: line.line,
                isError: line.is_error ? true : false
            };
        });
    }

    // async updateJobLog() {
    //     const startingLines = this.state.log.length;
    //     const lines = await this.getJobLog(startingLines);
    //     this.setState({
    //         log: {
    //             isLoaded: this.state.log.isLoaded,
    //             lines: this.state.log.lines.concat(lines)
    //         }
    //     })
    // }

    startPolling() {
        const poller = async () => {
            const state = this.state;
            if (state.status !== JobLogState.ACTIVE_LOADED) {
                this.setState({
                    status: JobLogState.ERROR,
                    error: 'Invalid state for polling: ' + state.status
                });
                return;
            }
            const { log } = state;
            this.setState({
                status: JobLogState.ACTIVE_LOADING,
                log
            });
            const job = await this.getJob();
            const startingLines = log.length;
            const newLog = await this.getJobLog(startingLines);

            switch (job.status) {
                case JobStatus.QUEUED:
                    // should not occur!
                    this.startQueuedPolling();
                    break;
                case JobStatus.RUNNING:
                    this.setState({
                        status: JobLogState.ACTIVE_LOADED,
                        log: log.concat(newLog),
                        job
                    });
                    loop();
                    break;
                case JobStatus.FINISHED:
                    this.setState({
                        status: JobLogState.FINISHED_LOADED,
                        log: log.concat(newLog),
                        job
                    });
                    break;
                case JobStatus.ERRORED:
                    this.setState({
                        status: JobLogState.FINISHED_LOADED,
                        log: log.concat(newLog),
                        job
                    });
                    break;
                case JobStatus.CANCELED:
                    this.setState({
                        status: JobLogState.FINISHED_LOADED,
                        log: log.concat(newLog),
                        job
                    });
            }
        }
        const loop = () => {
            setTimeout(poller, POLLING_INTERVAL);
        }
        loop();
    }

    startQueuedPolling() {
        const poller = async () => {
            const job = await this.getJob();
            switch (job.status) {
                case JobStatus.QUEUED:
                    // still queued, eh?
                    loop();
                    return;
                default:
                    const log = await this.getJobLog(0);
                    switch (job.status) {
                        case JobStatus.RUNNING:
                            this.setState({
                                status: JobLogState.ACTIVE_LOADED,
                                log,
                                job
                            });
                            loop();
                            break;
                        case JobStatus.FINISHED:
                            this.setState({
                                status: JobLogState.FINISHED_LOADED,
                                log,
                                job
                            });
                            break;
                        case JobStatus.ERRORED:
                            this.setState({
                                status: JobLogState.FINISHED_LOADED,
                                log,
                                job
                            });
                            break;
                        case JobStatus.CANCELED:
                            this.setState({
                                status: JobLogState.FINISHED_LOADED,
                                log,
                                job
                            });
                            break;
                    }
            }
        }

        const loop = () => {
            setTimeout(poller, POLLING_INTERVAL);
        }

        loop();
    }

    async getInitialJobLog() {
        this.setState({
            status: JobLogState.INITIAL_LOADING
        });
        const job = await this.getJob();
        // const log = await this.getJobLog(0);

        let log;
        switch (job.status) {
            case JobStatus.QUEUED:
                // still queued, eh?
                this.setState({
                    status: JobLogState.JOB_QUEUED,
                    job
                });
                this.startQueuedPolling();
                return;
            case JobStatus.RUNNING:
                log = await this.getJobLog(0);
                this.setState({
                    status: JobLogState.ACTIVE_LOADED,
                    log,
                    job
                });
                return;
            case JobStatus.FINISHED:
                log = await this.getJobLog(0);
                this.setState({
                    status: JobLogState.FINISHED_LOADED,
                    log,
                    job
                });
                return;
            case JobStatus.ERRORED:
                log = await this.getJobLog(0);
                this.setState({
                    status: JobLogState.FINISHED_LOADED,
                    log,
                    job
                });
                return;
            case JobStatus.CANCELED:
                log = await this.getJobLog(0);
                this.setState({
                    status: JobLogState.FINISHED_LOADED,
                    log,
                    job
                });
                return;
        }
    }

    componentDidMount() {
        this.getInitialJobLog();
    }

    renderLoading() {
        return (
            <div>
                Loading ... <Spin />
            </div>
        );
    }

    renderQueued() {
        return (
            <div>
                Queued ... <Spin />
            </div>
        );
    }

    renderError(view: JobLogViewError) {
        return (
            <Alert type="error" message={view.error} />
        )
    }

    render() {
        return <JobDetailComponent view={this.state} />;
    }
}
