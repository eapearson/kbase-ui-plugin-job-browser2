import { Job, JobsSearchExpression, EpochTime, StoreState } from '../store';
import MetricsServiceClient from '../../lib/MetricsServiceClient';
import { serviceJobToUIJob, compareTimeRange, compareStatus, extractTimeRange } from './utils';
import { Action } from 'redux';
import { ActionType } from '.';
import { NarrativeJobServiceClient } from '@kbase/ui-lib';
import { AppError } from '@kbase/ui-components';
import { ThunkDispatch } from 'redux-thunk';
import CancelableRequest, { Task } from '../../lib/CancelableRequest';

export interface UserJobsSearch extends Action<ActionType.USER_JOBS_SEARCH> {
    type: ActionType.USER_JOBS_SEARCH;
    searchExpression: JobsSearchExpression;
}

export interface UserJobsSearchStart extends Action<ActionType.USER_JOBS_SEARCH_START> {
    type: ActionType.USER_JOBS_SEARCH_START;
}

export interface UserJobsSearchSuccess extends Action<ActionType.USER_JOBS_SEARCH_SUCCESS> {
    type: ActionType.USER_JOBS_SEARCH_SUCCESS;
    searchExpression: JobsSearchExpression;
    rawJobs: Array<Job>;
    jobs: Array<Job>;
    jobsFetchedAt: EpochTime;
}

export interface UserJobsSearchError extends Action<ActionType.USER_JOBS_SEARCH_ERROR> {
    type: ActionType.USER_JOBS_SEARCH_ERROR;
    error: AppError;
}

export function userJobsSearchStart(): UserJobsSearchStart {
    return {
        type: ActionType.USER_JOBS_SEARCH_START
    };
}

export function userJobsSearchSuccess(
    rawJobs: Array<Job>,
    jobs: Array<Job>,
    jobsFetchedAt: EpochTime,
    searchExpression: JobsSearchExpression
): UserJobsSearchSuccess {
    return {
        type: ActionType.USER_JOBS_SEARCH_SUCCESS,
        searchExpression,
        rawJobs,
        jobs,
        jobsFetchedAt
    };
}

export function userJobsSearchError(error: AppError): UserJobsSearchError {
    return {
        type: ActionType.USER_JOBS_SEARCH_ERROR,
        error
    };
}

interface UserJobsParam {
    token: string,
    serviceWizardURL: string,
    from: number,
    to: number
}

type UserJobsResult = Array<Job>;

class UserJobsRequest extends CancelableRequest<UserJobsParam, UserJobsResult> {
    request({ token, serviceWizardURL, from, to }: UserJobsParam): Task<UserJobsResult> {
        const client = new MetricsServiceClient({
            url: serviceWizardURL,
            token: token
        });
        const promise = client
            .getJobs({
                epoch_range: [from, to],
                user_ids: []
            })
            .then((metrics) => {
                const converted = metrics.job_states.map((jobState) => {
                    return serviceJobToUIJob(jobState, 'UNKNOWN');
                });
                return converted;
            })

        const task: Task<UserJobsResult> = {
            id: this.newID(),
            promise,
            isCanceled: false
        }
        this.pendingTasks.set(task.id, task);
        return task;
    }
}

const userJobsSearchRequest = new UserJobsRequest();

export function userJobsSearch(searchExpression: JobsSearchExpression) {
    return async (dispatch: ThunkDispatch<StoreState, void, Action>, getState: () => StoreState) => {
        dispatch(userJobsSearchStart());

        const {
            auth: { userAuthorization },
            app: {
                config: {
                    services: {
                        ServiceWizard: { url: serviceWizardURL }
                    }
                }
            }
        } = getState();

        if (!userAuthorization) {
            dispatch(
                userJobsSearchError({
                    message: 'Not authorized',
                    code: 'unauthorized'
                })
            );
            return;
        }

        let {
            views: {
                userJobsView: { jobsFetchedAt, rawJobs }
            }
        } = getState();

        const searchTerms = searchExpression.query.split(/\s+/).map((term) => {
            return new RegExp(term, 'i');
        });

        const [timeRangeStart, timeRangeEnd] = extractTimeRange(searchExpression.timeRange);

        if (!jobsFetchedAt || searchExpression.forceSearch) {

            const task = userJobsSearchRequest.spawn({
                token: userAuthorization.token,
                serviceWizardURL,
                from: timeRangeStart,
                to: timeRangeEnd
            });

            rawJobs = await task.promise;
            if (task.isCanceled) {
                // just do nothing
                return;
            }
            jobsFetchedAt = new Date().getTime();
            userJobsSearchRequest.done(task);

            // rawJobs = await fetchAllUserJobs(userAuthorization.token, serviceWizardURL, timeRangeStart, timeRangeEnd);
            jobsFetchedAt = new Date().getTime();
            // UPDATE: update the raw jobs
        }

        const newJobs = rawJobs.filter((job) => {
            return (
                searchTerms.every((term) => {
                    return term.test(job.appTitle) || term.test(job.narrativeTitle) || term.test(job.id) || term.test(job.username)
                }) &&
                compareTimeRange(
                    job,
                    // searchExpression.timeRange,
                    timeRangeStart,
                    timeRangeEnd
                ) &&
                compareStatus(job, searchExpression.jobStatus)
            );
        });

        dispatch(userJobsSearchSuccess(rawJobs, newJobs, jobsFetchedAt, searchExpression));
    };
}

export function userJobsRefreshSearch() {
    return async (dispatch: ThunkDispatch<StoreState, void, Action>, getState: () => StoreState) => {
        dispatch(userJobsSearchStart());

        const {
            auth: { userAuthorization }
        } = getState();

        if (!userAuthorization) {
            dispatch(
                userJobsSearchError({
                    message: 'Not authorized',
                    code: 'unauthorized'
                })
            );
            return;
        }

        const {
            app: {
                config: {
                    services: {
                        ServiceWizard: { url: serviceWizardURL }
                    }
                }
            },
            views: {
                userJobsView: { searchExpression }
            }
        } = getState();

        if (!searchExpression) {
            userJobsSearchError({
                message: 'No search expression',
                code: 'nosearchexpression'
            });
            return;
        }

        const searchTerms = searchExpression.query.split(/\s+/).map((term) => {
            return new RegExp(term, 'i');
        });

        const [timeRangeStart, timeRangeEnd] = extractTimeRange(searchExpression.timeRange);


        const task = userJobsSearchRequest.spawn({
            token: userAuthorization.token,
            serviceWizardURL,
            from: timeRangeStart,
            to: timeRangeEnd
        });

        const rawJobs = await task.promise;
        if (task.isCanceled) {
            // just do nothing
            return;
        }

        userJobsSearchRequest.done(task);

        const newJobs = rawJobs.filter((job) => {
            return (
                searchTerms.every((term) => {
                    return term.test(job.appTitle) || term.test(job.narrativeTitle);
                }) &&
                compareTimeRange(
                    job,
                    // searchExpression.timeRange,
                    timeRangeStart,
                    timeRangeEnd
                ) &&
                compareStatus(job, searchExpression.jobStatus)
            );
        });

        dispatch(userJobsSearchSuccess(rawJobs, newJobs, Date.now(), searchExpression));
    };
}

// user job cancellation...
// Job Cancelation

export interface UserJobsCancelJob {
    type: ActionType.USER_JOBS_CANCEL;
    jobID: string;
}

export interface UserJobsCancelJobStart {
    type: ActionType.USER_JOBS_CANCEL_START;
}

export interface UserJobsCancelJobSuccess {
    type: ActionType.USER_JOBS_CANCEL_SUCCESS;
}

export interface UserJobsCancelJobError {
    type: ActionType.USER_JOBS_CANCEL_ERROR;
    error: AppError;
}

export function userJobsCancelJobStart(): UserJobsCancelJobStart {
    return {
        type: ActionType.USER_JOBS_CANCEL_START
    };
}

export function userJobsCancelJobSuccess(): UserJobsCancelJobSuccess {
    return {
        type: ActionType.USER_JOBS_CANCEL_SUCCESS
    };
}

export function userJobsCancelJobError(error: AppError): UserJobsCancelJobError {
    return {
        type: ActionType.USER_JOBS_CANCEL_ERROR,
        error
    };
}

export function userJobsCancelJob(jobID: string) {
    return async (dispatch: ThunkDispatch<StoreState, void, Action>, getState: () => StoreState) => {
        dispatch(userJobsCancelJobStart());

        const {
            auth: { userAuthorization },
            app: {
                config: {
                    services: {
                        NarrativeJobService: { url: njsURL }
                    }
                }
            }
        } = getState();

        if (!userAuthorization) {
            dispatch(
                userJobsCancelJobError({
                    message: 'no authorization',
                    code: 'no-authorization'
                })
            );
            return;
        }

        // do it
        const njsClient = new NarrativeJobServiceClient({
            url: njsURL,
            token: userAuthorization.token,
            module: 'NarrativeJobService'
        });
        njsClient
            .cancelJob({ job_id: jobID })
            .then(() => {
                dispatch(userJobsCancelJobSuccess());
                dispatch(userJobsRefreshSearch());
            })
            .catch((err) => {
                console.error('error canceling job', err);
                dispatch(
                    userJobsCancelJobError({
                        message: 'error canceling job: ' + err.message,
                        code: 'error-canceling'
                    })
                );
            });
    };
}
