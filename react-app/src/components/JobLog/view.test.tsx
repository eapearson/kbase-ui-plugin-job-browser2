/**
 * Unit tests for the KBaseIntegration component
 */

// We need to import React, even though we don't explicity use it, because
// it's presence is required for JSX transpilation (the React object is
// used  in the transpiled code)
import React from 'react';
// Enzyme needs
import { configure, shallow, mount } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

// We always need to import the component we are testing
import Component from './view';
import { JobQueued, JobStatus } from '../../redux/store';
import { JobLog } from './state';

configure({ adapter: new Adapter() });

it('renders without crashing', () => {
    const jobLog: JobLog = [];
    const job: JobQueued = {
        id: '123',
        appID: 'module/app',
        appTitle: 'My App',
        clientGroups: ['njs'],
        narrativeID: 123,
        narrativeTitle: 'My Great Narrative',
        queuedAt: 123,
        queuedElapsed: 123,
        status: JobStatus.QUEUED,
        username: 'user1',
        key: '123'
    }
    shallow(<Component log={jobLog} job={job} />);
});

it('renders several lines', () => {
    const jobLog: JobLog = [
        {
            isError: false,
            lineNumber: 1,
            line: 'first line'
        },
        {
            isError: false,
            lineNumber: 2,
            line: 'second line'
        },
        {
            isError: false,
            lineNumber: 3,
            line: 'third line'
        }
    ];
    const job: JobQueued = {
        id: '123',
        appID: 'module/app',
        appTitle: 'My App',
        clientGroups: ['njs'],
        narrativeID: 123,
        narrativeTitle: 'My Great Narrative',
        queuedAt: 123,
        queuedElapsed: 123,
        status: JobStatus.QUEUED,
        username: 'user1',
        key: '123'
    }
    const theComponent = mount(<Component log={jobLog} job={job} />);
    theComponent.unmount();
});

it('renders several lines including an error', () => {
    const jobLog: JobLog = [
        {
            isError: false,
            lineNumber: 1,
            line: 'first line'
        },
        {
            isError: false,
            lineNumber: 2,
            line: 'second line'
        },
        {
            isError: true,
            lineNumber: 3,
            line: 'third line'
        }
    ];
    const job: JobQueued = {
        id: '123',
        appID: 'module/app',
        appTitle: 'My App',
        clientGroups: ['njs'],
        narrativeID: 123,
        narrativeTitle: 'My Great Narrative',
        queuedAt: 123,
        queuedElapsed: 123,
        status: JobStatus.QUEUED,
        username: 'user1',
        key: '123'
    }
    const theComponent = mount(<Component log={jobLog} job={job} />);
    theComponent.unmount();
});
